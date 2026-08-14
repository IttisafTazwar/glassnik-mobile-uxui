import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const useNativeDriver = Platform.OS !== 'web';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { SampleVideo } from '@/constants/sampleVideos';
import { userApi, videoApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMute } from '@/context/MuteContext';

interface Props {
  video: SampleVideo;
  isActive: boolean;
  /** Called when the comment button is pressed; receives the video's id. */
  onCommentPress?: (videoId: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FeedVideoItem({ video, isActive, onCommentPress }: Props) {
  const { isMuted, toggleMute } = useMute();
  const onMuteToggle = toggleMute;
  const { width, height } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const lastTap = useRef(0);
  const { user } = useAuth();
  const isOwnVideo = user?.id != null && video.creatorId != null && video.creatorId === user.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Heart animation ──
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  // ── Music disc rotation ──
  const discRotation = useRef(new Animated.Value(0)).current;
  const discAnim = useRef<Animated.CompositeAnimation | null>(null);

  // ── Video player ──
  const player = useVideoPlayer(video.uri, useCallback((p: import('expo-video').VideoPlayer) => {
    p.loop = true;
  }, []));

  // Sync play/pause AND muted together — muted must be set before play()
  // so the native layer never has a chance to start audio then cut it.
  useEffect(() => {
    try {
      player.muted = isMuted;
      if (isActive && !paused) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive, paused, player, isMuted]);

  // Progress tracking
  useEffect(() => {
    if (!isActive) { setProgress(0); return; }
    const id = setInterval(() => {
      try {
        const d = player.duration;
        const t = player.currentTime;
        if (d > 0) setProgress(t / d);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [isActive, player]);

  // Disc spin
  useEffect(() => {
    discAnim.current?.stop();
    if (isActive && !paused) {
      discRotation.setValue(0);
      discAnim.current = Animated.loop(
        Animated.timing(discRotation, {
          toValue: 1,
          duration: 5000,
          easing: Easing.linear,
          useNativeDriver,
        })
      );
      discAnim.current.start();
    }
    return () => { discAnim.current?.stop(); };
  }, [isActive, paused, discRotation]);

  const spinStyle = {
    transform: [{
      rotate: discRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    }],
  };

  function triggerHeartAnim() {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.2, useNativeDriver, friction: 4 }),
      Animated.timing(heartScale, { toValue: 1, duration: 100, useNativeDriver }),
      Animated.delay(400),
      Animated.timing(heartOpacity, { toValue: 0, duration: 400, useNativeDriver }),
    ]).start();
  }

  function handleLike() {
    const wasLiked = liked;
    if (!wasLiked) {
      triggerHeartAnim();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    // Persist to backend (optimistic — no cache invalidation to avoid feed re-fetch)
    const apiCall = wasLiked
      ? videoApi.unlikeVideo(video.id)
      : videoApi.likeVideo(video.id);
    apiCall.catch(() => {
      // Revert optimistic update on failure
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    });
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      handleLike();
      triggerHeartAnim();
    } else {
      setPaused((p) => !p);
    }
    lastTap.current = now;
  }

  async function handleFollow() {
    if (!user) {
      Alert.alert(
        'Sign in required',
        'You need to be signed in to follow videographers.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    if (!video.creatorId || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = following;
    // Optimistic update
    setFollowing(!wasFollowing);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (wasFollowing) {
        await userApi.unfollow(video.creatorId);
      } else {
        await userApi.follow(video.creatorId);
      }
      // Invalidate the current user's profile stats so following/follower counts refresh
      queryClient.invalidateQueries({ queryKey: ['profile-stats', user.id] });
    } catch {
      // Revert optimistic update on failure
      setFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  }

  const ITEM_HEIGHT = height;

  return (
    <View style={[styles.container, { width, height: ITEM_HEIGHT }]}>
      {/* ── Video / thumbnail ── */}
      {isActive ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : video.thumbnailUrl ? (
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
      )}

      {/* ── Tap handler ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      {/* ── Bottom gradient layers (simulate linear gradient) ── */}
      <View style={[styles.gradientTop, { pointerEvents: 'none' }]} />
      <View style={[styles.gradientBottom, { pointerEvents: 'none' }]} />

      {/* ── Pause indicator ── */}
      {paused && isActive && (
        <View style={[styles.pauseOverlay, { pointerEvents: 'none' }]}>
          <View style={styles.pauseIcon}>
            <Feather name="pause" size={44} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      )}

      {/* ── Double-tap heart ── */}
      <Animated.View
        style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }], pointerEvents: 'none' }]}
      >
        <Feather name="heart" size={90} color="#fff" />
      </Animated.View>

      {/* ── Right sidebar ── */}
      <View style={[styles.sidebar, { bottom: Platform.OS === 'web' ? 100 : 100 + 34 }]}>
        {/* Creator avatar + follow badge — hidden on own videos */}
        {!isOwnVideo && (
        <Pressable style={styles.sideItem} onPress={video.creatorId ? handleFollow : undefined} disabled={followLoading}>
          <View style={[styles.avatar, { backgroundColor: video.creator.color }]}>
            {video.creator.avatarUrl ? (
              <Image
                source={{ uri: video.creator.avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.avatarText}>{video.creator.initial}</Text>
            )}
          </View>
          {video.creatorId && !following && (
            <View style={styles.followBtn}>
              <Text style={styles.followPlus}>+</Text>
            </View>
          )}
          {video.creatorId && following && (
            <View style={[styles.followBtn, styles.followBtnActive]}>
              <Feather name="check" size={11} color="#fff" />
            </View>
          )}
        </Pressable>
        )}

        {/* Like */}
        <Pressable style={styles.sideItem} onPress={handleLike}>
          <Feather
            name="heart"
            size={32}
            color={liked ? '#FE2C55' : '#fff'}
            style={liked ? styles.likedHeart : undefined}
          />
          <Text style={styles.sideLabel}>{formatCount(likeCount)}</Text>
        </Pressable>

        {/* Comment — opens CommentsSheet */}
        <Pressable
          style={styles.sideItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onCommentPress?.(video.id);
          }}
        >
          <Feather name="message-circle" size={32} color="#fff" />
          <Text style={styles.sideLabel}>{formatCount(video.comments)}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.sideItem}>
          <Feather name="share-2" size={30} color="#fff" />
          <Text style={styles.sideLabel}>{formatCount(video.shares)}</Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable style={styles.sideItem}>
          <Feather name="bookmark" size={30} color="#fff" />
          <Text style={styles.sideLabel}>Save</Text>
        </Pressable>

        {/* Spinning music disc */}
        <Pressable style={styles.sideItem} onPress={onMuteToggle}>
          <Animated.View style={[styles.disc, spinStyle]}>
            <View style={[styles.discInner, { backgroundColor: video.creator.color }]}>
              <Text style={styles.discNote}>♪</Text>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* ── Bottom info ── */}
      <View style={[styles.bottomInfo, { paddingBottom: Platform.OS === 'web' ? 80 : 114 }]}>
       {/* Creator + follow — hidden on own videos */}
        {!isOwnVideo && <View style={styles.creatorRow}>
          <Text style={styles.creatorName}>@{video.creator.username}</Text>
          {video.creatorId && (
            <Pressable
              style={[styles.followTextBtn, following && styles.followTextBtnActive]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {following ? (
                <View style={styles.followingRow}>
                  <Feather name="check" size={11} color="#fff" />
                  <Text style={styles.followTextBtnLabel}>Following</Text>
                </View>
              ) : (
                <Text style={styles.followTextBtnLabel}>Follow</Text>
              )}
            </Pressable>
          )}
            </View>
        }
        

        {/* Location + category on one line — tappable, navigates to Explore */}
        {(video.place || video.city || video.country || video.category) ? (
          <View style={styles.metaRow}>
            {(video.place || video.city || video.country) ? (
              <Pressable style={styles.locationWrap} onPress={() => router.push('/(tabs)/explore')}>
                <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.locationText}>
                  {[video.place, video.city, video.country].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ) : null}
            {video.category ? (
              <Pressable style={styles.categoryPill} onPress={() => router.push('/(tabs)/explore')}>
                <Text style={styles.categoryText}>{video.category.toUpperCase()}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── Progress bar ── */}
      <View style={[styles.progressTrack, { bottom: Platform.OS === 'web' ? 62 : 84 }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoPlaceholder: {
    backgroundColor: '#111',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'transparent',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 340,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Pause
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Heart double-tap
  heartOverlay: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },

  // Right sidebar
  sidebar: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
  },
  sideItem: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  followBtn: {
    position: 'absolute',
    bottom: -12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FE2C55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: '#555',
  },
  followPlus: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'center',
  },
  sideLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  likedHeart: {},

  // Music disc
  disc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    borderWidth: 3,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  discInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discNote: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Bottom info
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 76,
    paddingHorizontal: 16,
    gap: 6,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followTextBtn: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  followTextBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  followTextBtnLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  locationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  // Progress bar
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    minWidth: 2,
  },
});