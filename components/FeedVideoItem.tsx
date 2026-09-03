import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
  onCommentPress?: (videoId: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FeedVideoItem({ video, isActive, onCommentPress }: Props) {
  const { isMuted } = useMute();
  const { width, height } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const lastTap = useRef(0);
  const { user } = useAuth();
  const isOwnVideo = user?.id != null && video.creatorId != null && video.creatorId === user.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(video.uri, useCallback((p: import('expo-video').VideoPlayer) => {
    p.loop = true;
  }, []));

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
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    const apiCall = wasLiked
      ? videoApi.unlikeVideo(video.id)
      : videoApi.likeVideo(video.id);
    apiCall.catch(() => {
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
    setFollowing(!wasFollowing);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (wasFollowing) {
        await userApi.unfollow(video.creatorId);
      } else {
        await userApi.follow(video.creatorId);
      }
      queryClient.invalidateQueries({ queryKey: ['profile-stats', user.id] });
    } catch {
      setFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  }

  const ITEM_HEIGHT = height;

  const placeTourTransport = video.description || null;
  const locationText = [video.place, video.city, video.country].filter(Boolean).join(', ') || null;
  const metaLine = [placeTourTransport, locationText].filter(Boolean).join(' • ');

  return (
    <View style={[styles.container, { width, height: ITEM_HEIGHT }]}>
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

      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      <View style={[styles.gradientBottom, { pointerEvents: 'none' }]} />

      {paused && isActive && (
        <View style={[styles.pauseOverlay, { pointerEvents: 'none' }]}>
          <View style={styles.pauseIcon}>
            <Feather name="pause" size={44} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      )}

      <Animated.View
        style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }], pointerEvents: 'none' }]}
      >
        <Feather name="heart" size={90} color="#fff" />
      </Animated.View>

      {/* Right-side floating sidebar (avatar, follow badge, music disc)
          removed entirely — this was the "strange icon" reappearing and
          the reason icons looked like they were "invading the picture"
          instead of sitting in the black box below, consistent with the
          Explore page cards. Everything now lives in the single bottom
          box only, matching Steve's explicit request. */}

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
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

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

  heartOverlay: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },

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