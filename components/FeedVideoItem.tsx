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
import { useEvent } from 'expo';
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
  isFirstVideo?: boolean;
  shouldPreload?: boolean;
  itemWidth?: number;
  itemHeight?: number;
  /** Called when the comment button is pressed; receives the video's id. */
  onCommentPress?: (videoId: string) => void;
  /** Optional callback for overlays that should follow tap-to-hide controls. */
  onControlsVisibilityChange?: (visible: boolean) => void;
  /** Category-feed presentation without creator attribution and with compact mute placement. */
  categoryMode?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}


function WebFeedVideo({
  uri,
  isActive,
  isMuted,
  isFirstVideo = false,
  objectFit = 'cover',
  onAutoplayMuted,
  onPlaying,
}: {
  uri: string;
  isActive: boolean;
  isMuted: boolean;
  isFirstVideo?: boolean;
  objectFit?: 'cover' | 'contain';
  onAutoplayMuted?: () => void;
  onPlaying?: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const previousActiveRef = React.useRef(false);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;

    el.playsInline = true;
    el.loop = true;

    const getBufferedAhead = () => {
      if (!Number.isFinite(el.currentTime) || !el.buffered.length) {
        return 0;
      }

      for (let i = 0; i < el.buffered.length; i++) {
        if (
          el.currentTime >= el.buffered.start(i) &&
          el.currentTime <= el.buffered.end(i)
        ) {
          return Math.max(
            0,
            el.buffered.end(i) - el.currentTime,
          );
        }
      }

      return 0;
    };

    const playActiveVideo = async () => {
      if (
        cancelled ||
        !isActive ||
        videoRef.current !== el
      ) {
        return;
      }

      try {
        // Active feed videos should autoplay muted.
        // Do not wait for an arbitrary buffer amount; let the browser
        // start as soon as enough data is available.
        if (isFirstVideo) {
          el.muted = true;
        } else {
          el.muted = isMuted;
        }

        await el.play();
        onPlaying?.();
      } catch {
        if (cancelled || !isActive) return;

        // Browser autoplay policies may reject playback with sound.
        // Fall back to muted playback so the feed can still autoplay.
        el.muted = true;

        try {
          await el.play();
          onAutoplayMuted?.();
          onPlaying?.();
        } catch {}
      }
    };

    const handleCanPlay = () => {
      if (isActive && el.paused) {
        void playActiveVideo();
      }
    };

    const handleProgress = () => {
      if (isActive && el.paused) {
        void playActiveVideo();
      }
    };

    const handleWaiting = () => {
      if (!isActive || cancelled) return;

      // Let the browser refill instead of repeatedly
      // calling play() while the network is behind.
      try {
        el.pause();
      } catch {}
    };

    if (!isActive) {
      previousActiveRef.current = false;

      try {
        el.pause();
        el.currentTime = 0;
      } catch {}

      return;
    }

    // Reset only when this video becomes active.
    if (!previousActiveRef.current) {
      try {
        el.currentTime = 0;
      } catch {}
    }

    previousActiveRef.current = true;

    // First video starts muted for autoplay compatibility.
    // Other videos follow the user's mute preference.
    el.muted = isFirstVideo ? true : isMuted;

    el.addEventListener('canplay', handleCanPlay);
    el.addEventListener('loadeddata', handleCanPlay);
    el.addEventListener('progress', handleProgress);
    el.addEventListener('waiting', handleWaiting);

    if (el.readyState >= 2) {
      void playActiveVideo();
    }

    return () => {
      cancelled = true;

      el.removeEventListener('canplay', handleCanPlay);
      el.removeEventListener('loadeddata', handleCanPlay);
      el.removeEventListener('progress', handleProgress);
      el.removeEventListener('waiting', handleWaiting);
    };
  }, [isActive, uri, isFirstVideo]);

  // Keep the user's mute preference without
  // restarting or seeking the video.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = isMuted;

    if (isActive && el.paused) {
      const result = el.play();

      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          el.muted = true;
          el.play().catch(() => {});
        });
      }
    }
  }, [isMuted, isActive, isFirstVideo]);

  return React.createElement('video', {
    ref: videoRef,
    src: uri,
    playsInline: true,

    // Active video gets aggressive loading.
    // Preloaded next video stays lighter so it doesn't
    // compete with the active video's bandwidth.
    preload: isActive ? 'auto' : 'metadata',

    // Give the active video network priority.
    fetchPriority: isActive ? 'high' : 'low',

    autoPlay: isActive,
    muted: isMuted,
    loop: true,

    onPlaying,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit,
      objectPosition: 'center',
    },
  });
}

export function FeedVideoItem({ video, isActive, isFirstVideo = false, shouldPreload = true, itemWidth, itemHeight, onCommentPress, onControlsVisibilityChange, categoryMode = false }: Props) {
  const { isMuted, toggleMute, setMuted } = useMute();
  const onMuteToggle = toggleMute;

  const handleAutoplayMuted = React.useCallback(() => {
    setMuted(true);
  }, [setMuted]);
  const { width, height } = useWindowDimensions();
  const resolvedWidth = itemWidth ?? width;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [paused, setPaused] = useState(false);
  // Instagram-style tap-to-hide, combined with the existing single-tap
  // pause toggle (no separate gesture was specified).
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);

  // Keep the thumbnail visible until the active video actually starts.
  useEffect(() => {
    if (!isActive) setVideoStarted(false);
  }, [isActive, video.id]);

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

    if (Platform.OS !== 'web') {
      p.bufferOptions = {
        preferredForwardBufferDuration: 8,
        minBufferForPlayback: 1,
        prioritizeTimeOverSizeThreshold: true,
      };
    }
  }, []));

  // Track whether the native player has loaded enough to play reliably.
  const { status: playerStatus } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const { isPlaying: nativeIsPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' && isActive && nativeIsPlaying) {
      setVideoStarted(true);
    }
  }, [isActive, nativeIsPlaying]);

  // Keep playback controlled from one place.
  // Explicitly request playback whenever a previously viewed video
  // becomes active again.
  useEffect(() => {
    let cancelled = false;

    const syncPlayback = async () => {
      try {
        player.muted = isMuted;

        if (!isActive) {
          player.pause();
          setPaused(false);
          return;
        }

        if (paused) {
          player.pause();
          return;
        }

        // Give the player a moment to transition back to the active item.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));

        if (!cancelled && isActive && !paused) {
          player.play();
        }
      } catch {}
    };

    void syncPlayback();

    return () => {
      cancelled = true;
    };
  }, [isActive, paused, isMuted, player]);

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
      setControlsVisible((v) => {
        const next = !v;
        onControlsVisibilityChange?.(next);
        return next;
      });
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

  const ITEM_HEIGHT = itemHeight ?? height;
  const isDesktopWeb = Platform.OS === 'web' && itemWidth != null;
  // Desktop For You:
  // Reserve a separate area underneath the video for the controls.
  // The video itself uses contain so its original aspect ratio is preserved.
  // Desktop: the complete card remains ITEM_HEIGHT.
  // Reserve the bottom portion INSIDE that card for creator,
  // metadata and reaction controls.
  const desktopInfoHeight = isDesktopWeb ? 118 : 0;
  const desktopVideoHeight = ITEM_HEIGHT;

  // Place/Tour/Transport • Location — single line, per the mockup.
  const placeTourTransport = video.description || null;
  // Place/title is already shown on the first line.
  // Second line should only show city + country.
  const locationText = [video.city, video.country].filter(Boolean).join(', ') || null;
  const metaLine = [placeTourTransport, locationText].filter(Boolean).join(' • ');

  return (
    <View style={[
      styles.container,
      {
        width: resolvedWidth,
        height: ITEM_HEIGHT,
      },
    ]}>
      {/* ── Video / thumbnail ── */}
      <View
        style={
          isDesktopWeb
            ? {
                width: resolvedWidth,
                height: desktopVideoHeight,
                position: 'relative',
              }
            : StyleSheet.absoluteFill
        }
      >
      {isDesktopWeb ? (
        <>
          {shouldPreload ? (
            <WebFeedVideo
              uri={video.uri}
              isActive={isActive}
              isMuted={isMuted}
              isFirstVideo={isFirstVideo}
              objectFit="cover"
              onAutoplayMuted={handleAutoplayMuted}
              onPlaying={() => setVideoStarted(true)}
            />
          ) : null}

          {(!isActive || !videoStarted) && video.thumbnailUrl ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : !isActive ? (
            <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
          ) : null}
        </>
      ) : (
        <>
          {Platform.OS === 'web' ? (
            shouldPreload ? (
              <WebFeedVideo
                uri={video.uri}
                isActive={isActive}
                isMuted={isMuted}
                isFirstVideo={isFirstVideo}
                onAutoplayMuted={handleAutoplayMuted}
                onPlaying={() => setVideoStarted(true)}
              />
            ) : null
          ) : (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          )}

          {(!isActive || !videoStarted) && video.thumbnailUrl ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </>
      )}
      </View>

      {/* ── Tap handler ──
          touchAction: 'pan-y' on web tells the browser this element should
          still allow native vertical scroll/swipe gestures to pass through,
          instead of the touch being fully claimed by RN-Web's Pressable
          responder system. Without this, a full-screen Pressable sitting on
          top of the scrollable feed blocks mobile-browser scroll entirely —
          this is the fix for the "scroll not working over the videos on
          mobile" report. */}
      {!categoryMode && (
        <Pressable
          style={
            isDesktopWeb
              ? ({
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: desktopVideoHeight,
                  touchAction: 'pan-y',
                } as any)
              : [
                  StyleSheet.absoluteFill,
                  Platform.OS === 'web'
                    ? ({ touchAction: 'pan-y' } as any)
                    : null,
                ]
          }
          onPress={handleTap}
        />
      )}

      {/* No dark gradient over the video.
          Controls are displayed completely outside the video on desktop. */}

      {/* Mobile-only sound control overlaid on the video.
          Desktop keeps its existing sound control in the feed header. */}
      {/* Mobile videographer attribution — upper-left of video. */}
      {controlsVisible && !categoryMode && (
        <View style={styles.mobileCreatorAttribution}>
          <View style={styles.creatorRow}>
            <Text style={styles.creatorName}>@{video.creator.username}</Text>

            {isDesktopWeb && !isOwnVideo && video.creatorId && (
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
        </View>
      )}

      {!isDesktopWeb && (
        <Pressable
          style={styles.mobileMuteButton}
          onPress={onMuteToggle}
          hitSlop={10}
        >
          <Feather
            name={isMuted ? 'volume-x' : 'volume-2'}
            size={16}
            color="#fff"
          />
        </Pressable>
      )}

      {/* ── Double-tap heart ── */}
      <Animated.View
        style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }], pointerEvents: 'none' }]}
      >
        <Feather name="heart" size={90} color="#fff" />
      </Animated.View>

      {/* ── Bottom info/control box — overlays the video, flush to the
          bottom and both side edges, compact and semi-transparent.
          Progress bar sits immediately above it. Both hidden together on
          tap per the spec. Save button removed; action icons are Like/
          Comment/Share/Report only, smaller and soft grey. */}
      {controlsVisible && (
        <View
          style={[
            styles.progressTrack,
            !isDesktopWeb && {
              bottom: 0,
              zIndex: 30,
            },
            isDesktopWeb && {
              bottom: 0,
              zIndex: 30,
            },
          ]}
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {controlsVisible && (
        <View
          style={[
            styles.bottomBox,
            !isDesktopWeb && styles.mobileBottomOverlay,
            isDesktopWeb && {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: desktopInfoHeight,
              backgroundColor: 'transparent',
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 8,
              justifyContent: 'center',
              gap: 7,
              zIndex: 20,
            },
          ]}
        >
          {!isDesktopWeb && (
            <View style={styles.mobileGradient} pointerEvents="none">

            </View>
          )}

          <View style={styles.mobileOverlayContent}>
          {isDesktopWeb ? (
            <View style={styles.desktopMetaBlock}>
              {placeTourTransport ? (
                <View style={styles.desktopMetaTopRow}>
                  <Text style={styles.desktopPlaceText} numberOfLines={1}>
                    {placeTourTransport}
                  </Text>

                  <Pressable
                    style={styles.desktopMuteButton}
                    onPress={onMuteToggle}
                    hitSlop={10}
                  >
                    <Feather
                      name={isMuted ? 'volume-x' : 'volume-2'}
                      size={14}
                      color="#fff"
                    />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.desktopMetaBottomRow}>
                {locationText ? (
                  <Text style={styles.desktopLocationText} numberOfLines={1}>
                    {locationText}
                  </Text>
                ) : null}

                {video.category ? (
                  <Pressable
                    style={styles.categoryPill}
                    onPress={() => {
                      router.replace({
                        pathname: '/(tabs)/explore',
                        params: {
                          category: video.category,
                        },
                      } as any);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.categoryText}>
                      {video.category.toUpperCase()}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.mobileDiscoveryBlock}>
              {placeTourTransport ? (
                <Text style={styles.mobilePlaceText} numberOfLines={1}>
                  {placeTourTransport}
                </Text>
              ) : null}

              <View style={styles.mobileDestinationRow}>
                {locationText ? (
                  <Text style={styles.mobileDestinationText} numberOfLines={1}>
                    {locationText}
                  </Text>
                ) : null}

                {video.category ? (
                  <Pressable
                    style={styles.categoryPill}
                    onPress={() => {
                      router.replace({
                        pathname: '/(tabs)/explore',
                        params: {
                          category: video.category,
                        },
                      } as any);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.categoryText}>
                      {video.category.toUpperCase()}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

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
  // Intentionally no bottom gradient.
  // The video remains unobstructed and the controls sit below it.

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
  mobileMuteButton: {
    position: 'absolute',
    bottom: 82,
    right: 14,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },

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
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  mobileBottomOverlay: {
    backgroundColor: 'transparent',
    paddingTop: 36,
    paddingBottom: 8,
    overflow: 'hidden',
    zIndex: 40,
  },
  mobileGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  mobileGradientLight: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mobileGradientMedium: {
    height: 48,
    backgroundColor: 'transparent',
  },
  mobileGradientDark: {
    height: 72,
    backgroundColor: 'transparent',
  },
  mobileOverlayContent: {
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
  mobileCreatorAttribution: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 35,
  },
  mobileDiscoveryBlock: {
    gap: 4,
  },
  mobilePlaceText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mobileDestinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mobileDestinationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  desktopMetaBlock: {
    width: '100%',
    gap: 3,
  },
  desktopMetaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  desktopMetaBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  desktopPlaceText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  desktopLocationText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  desktopMuteButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    padding: 0,
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
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 0,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 48,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});