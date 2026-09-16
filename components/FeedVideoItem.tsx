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
import type { SampleVideo } from '@/constants/sampleVideos';
import { videoApi } from '@/lib/api';
import { useMute } from '@/context/MuteContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const isCompactMobile = width < 768;
  const itemWidth = Platform.OS === 'web' ? '100%' : width;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);
  const router = useRouter();

  // ── Heart animation ──
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  // ── Video player ──
  const player = useVideoPlayer(video.uri, (p) => {
    p.loop = true;
  });

  // Keep the feed player lifecycle aligned with the working Explore player.
  useEffect(() => {
    try {
      player.muted = isMuted;

      if (isActive && !paused && video.uri) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}

    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player, video.uri, isActive, paused, isMuted]);

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
    } else {
      setOverlayVisible((visible) => !visible);
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

  const ITEM_HEIGHT = itemHeight ?? height;

  return (
    <View style={[styles.container, { width: itemWidth, height: ITEM_HEIGHT }]}>
      {/* ── Video / thumbnail ── */}
      {isActive ? (
        <VideoView
          player={player}
          style={[
            StyleSheet.absoluteFill,
            !isCompactMobile && styles.desktopVideoStage,
          ]}
          contentFit="contain"
          nativeControls={false}
        />
      ) : video.thumbnailUrl ? (
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={[
            StyleSheet.absoluteFill,
            !isCompactMobile && styles.desktopVideoStage,
          ]}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.videoPlaceholder,
            !isCompactMobile && styles.desktopVideoStage,
          ]}
        />
      )}

      {/* ── Tap handler ── */}
      <Pressable
        style={[
          StyleSheet.absoluteFill,
          styles.videoTapLayer,
          !isCompactMobile && styles.desktopVideoStage,
          Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null,
        ]}
        onPress={handleTap}
      />

      {/* ── Bottom gradient layers (simulate linear gradient) ── */}
      <View style={[styles.gradientTop, { pointerEvents: 'none' }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          'transparent',
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0.35)',
        ]}
        locations={[0, 0.55, 1]}
        style={[
          styles.gradientBottom,
          !isCompactMobile && { bottom: 58 },
        ]}
      />

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

      {/* ── Bottom action bar — Love / Comment / Share / Report ── */}
      {overlayVisible && (
      <View
        style={[
          styles.actionBar,
          isCompactMobile
            ? { bottom: 82 }
            : styles.desktopActionBar,
        ]}
      >
        <Pressable style={styles.actionItem} onPress={handleLike}>
          <Feather
            name="heart"
            size={24}
            color={liked ? '#FE2C55' : '#fff'}
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
          <Feather name="message-circle" size={24} color="#fff" />
          <Text style={styles.actionLabel}>{formatCount(video.comments)}</Text>
        </Pressable>

        <Pressable style={styles.actionItem}>
          <Feather name="share-2" size={22} color="#fff" />
          <Text style={styles.actionLabel}>{formatCount(video.shares)}</Text>
        </Pressable>

        <Pressable style={styles.actionItem} onPress={handleReport}>
          <Feather name="flag" size={22} color="#fff" />
          <Text style={styles.actionLabel}>Report</Text>
        </Pressable>
      </View>
      )}

      {/* ── Bottom info ── */}
      {overlayVisible && (
      <View
        pointerEvents="box-none"
        style={[
          styles.bottomInfo,
          { paddingBottom: isCompactMobile ? 124 : 72 },
        ]}
      >
                {/* Location + category on one line — tappable, navigates to Explore */}
        {(video.place || video.city || video.country || video.category) ? (
          <View style={styles.metaRow}>
            {(video.place || video.city || video.country) ? (
              <Pressable
                style={styles.locationWrap}
                onPress={() => {
                  const location = [video.place, video.city, video.country]
                    .filter(Boolean)
                    .join(', ');

                  if (location) {
                    router.push(
                      `/explore?location=${encodeURIComponent(location)}`
                    );
                  } else {
                    router.push('/explore');
                  }
                }}
              >
                <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.locationText}>
                  {[video.place, video.city, video.country].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ) : null}
            {video.category ? (
              <Pressable
                style={styles.categoryPill}
                onPress={() => {
                  if (video.categoryId && video.category) {
                    router.push(
                      `/explore?categoryId=${video.categoryId}&category=${encodeURIComponent(video.category)}`
                    );
                  } else {
                    router.push('/explore');
                  }
                }}
              >
                <Text style={styles.categoryText}>{video.category.toUpperCase()}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      )}

      {/* ── Progress bar ── */}
      <View
        style={[
          styles.progressTrack,
          { bottom: isCompactMobile ? 54 : 58 },
        ]}
      >
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
  desktopVideoStage: {
    top: 0,
    bottom: 58,
    aspectRatio: 9 / 16,
    alignSelf: 'center',
  },
  videoTapLayer: {
    zIndex: 1,
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
    height: 300,
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
    zIndex: 30,
  },
  sideItem: {
    alignItems: 'center',
    gap: 4,
  },
  muteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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

  // Bottom action bar (Love / Comment / Share / Report)
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 30,
  },
  desktopActionBar: {
    bottom: 0,
    height: 58,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    paddingHorizontal: 18,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom info
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    zIndex: 10,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    gap: 4,
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
