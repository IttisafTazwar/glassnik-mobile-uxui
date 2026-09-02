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
  itemHeight?: number;
  /** Called when the comment button is pressed; receives the video's id. */
  onCommentPress?: (videoId: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FeedVideoItem({
  video,
  isActive,
  itemHeight,
  onCommentPress,
}: Props) {
  const { isMuted, toggleMute } = useMute();
  const onMuteToggle = toggleMute;
  const { width, height } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  // Instagram-style tap-to-hide, combined with the existing single-tap
  // pause toggle (no separate gesture was specified).
  const [controlsVisible, setControlsVisible] = useState(true);
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
      setControlsVisible((v) => !v);
    }
    lastTap.current = now;
  }

  function handleReport() {
    Alert.alert(
      'Report video',
      'Why are you reporting this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit report',
          style: 'destructive',
          onPress: () => {
            // NOTE: no report endpoint confirmed in lib/api.ts — this is a
            // local acknowledgement only, not a real backend submission.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('Thanks', 'Your report has been noted.');
          },
        },
      ],
    );
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

  const isMobile = width < 768;
  const ITEM_HEIGHT = itemHeight ?? height;
  const itemWidth = Platform.OS === 'web' && !isMobile ? '100%' : width;

  // Place/Tour/Transport • Location — single line, per the mockup.
  const placeTourTransport = video.description || null;
  const locationText = [video.place, video.city, video.country].filter(Boolean).join(', ') || null;
  const metaLine = [placeTourTransport, locationText].filter(Boolean).join(' • ');

  return (
    <View style={[styles.container, { width: itemWidth, height: ITEM_HEIGHT }]}>
      {/* ── Video / thumbnail ── */}
      {isActive ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={isMobile ? 'cover' : 'contain'}
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

      {/* ── Tap handler ──
          touchAction: 'pan-y' on web tells the browser this element should
          still allow native vertical scroll/swipe gestures to pass through,
          instead of the touch being fully claimed by RN-Web's Pressable
          responder system. Without this, a full-screen Pressable sitting on
          top of the scrollable feed blocks mobile-browser scroll entirely —
          this is the fix for the "scroll not working over the videos on
          mobile" report. */}
      <Pressable
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null,
        ]}
        onPress={handleTap}
      />

      {/* ── Bottom gradient layer (kept subtle since the info box now
          carries its own background) ── */}
      <View style={[styles.gradientBottom, { pointerEvents: 'none' }]} />

      {/* ── Pause indicator — independent of controlsVisible; this is
          playback-state feedback, not a "control" to hide ── */}
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

      {/* ── Right sidebar — avatar/follow, Music disc. Save removed per
          spec; the floating pink "+" follow badge removed per spec
          (Steve flagged it as an unidentified button interfering with
          immersion) — the avatar itself and follow interaction are kept,
          just moved to a plain outline badge instead of a filled pink one. */}
      {controlsVisible && (
        <View style={[styles.sidebar, { bottom: Platform.OS === 'web' ? 170 : 170 + 34 }]}>
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
                  <Feather name="plus" size={12} color="#fff" />
                </View>
              )}
              {video.creatorId && following && (
                <View style={[styles.followBtn, styles.followBtnActive]}>
                  <Feather name="check" size={11} color="#fff" />
                </View>
              )}
            </Pressable>
          )}

          {/* Spinning music disc */}
          <Pressable style={styles.sideItem} onPress={onMuteToggle}>
            <Animated.View style={[styles.disc, spinStyle]}>
              <View style={[styles.discInner, { backgroundColor: video.creator.color }]}>
                <Text style={styles.discNote}>♪</Text>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      )}

      {/* ── Bottom info/control box — overlays the video, flush to the
          bottom and both side edges, compact and semi-transparent.
          Progress bar sits immediately above it. Both hidden together on
          tap per the spec. Save button removed; action icons are Like/
          Comment/Share/Report only, smaller and soft grey. */}
      {controlsVisible && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {controlsVisible && (
        <View style={styles.bottomBox}>
          {!isOwnVideo && (
            <View style={styles.creatorRow}>
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
          )}

          {metaLine ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                {metaLine}
              </Text>
              {video.category ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{video.category.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.actionRow}>
            <Pressable style={styles.actionItem} onPress={handleLike}>
              <Feather
                name="heart"
                size={18}
                color={liked ? '#FE2C55' : 'rgba(255,255,255,0.7)'}
              />
              <Text style={styles.actionLabel}>{formatCount(likeCount)}</Text>
            </Pressable>

            <Pressable
              style={styles.actionItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onCommentPress?.(video.id);
              }}
            >
              <Feather name="message-circle" size={18} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>{formatCount(video.comments)}</Text>
            </Pressable>

            <Pressable style={styles.actionItem}>
              <Feather name="share-2" size={17} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>{formatCount(video.shares)}</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={handleReport}>
              <Feather name="flag" size={17} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actionLabel}>Report</Text>
            </Pressable>
          </View>
        </View>
      )}
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
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  // Follow badge — plain dark outline instead of the filled pink circle
  // Steve flagged as an unidentified button interfering with immersion.
  followBtn: {
    position: 'absolute',
    bottom: -12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: '#555',
    borderColor: '#555',
  },

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

  // Progress bar — flush above the bottom box
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 84,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    minWidth: 2,
  },

  // Bottom info/control box
  bottomBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorName: {
    color: '#fff',
    fontSize: 14,
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
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    gap: 3,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});