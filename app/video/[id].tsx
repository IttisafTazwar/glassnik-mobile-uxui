import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMute } from '@/context/MuteContext';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { videoApi } from '@/lib/api';
import type { VideoAsset } from '@/types';

export default function VideoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, data } = useLocalSearchParams<{ id?: string; data?: string }>();

  const { isMuted } = useMute();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Prefer the pre-serialised video passed as a param (instant); fall back to
  // fetching by ID so links that only carry the numeric ID work too.
  const passedVideo: VideoAsset | null = data ? (() => {
    try { return JSON.parse(data as string); } catch { return null; }
  })() : null;

  const { data: fetchedVideo, isLoading, isError } = useQuery({
    queryKey: ['video', id],
    queryFn: () => videoApi.getVideo(Number(id)),
    enabled: !passedVideo && !!id,
  });

  const video: VideoAsset | null = passedVideo ?? fetchedVideo ?? null;

  const videoUri = video?.publicUrl ?? null;

  const player = useVideoPlayer(videoUri, useCallback((p: VideoPlayer) => {
    p.loop = false;
    p.muted = isMuted;
    if (videoUri) p.play();
  }, [videoUri]));

  // Keep player in sync with global mute state
  React.useEffect(() => {
    try { player.muted = isMuted; } catch {}
  }, [isMuted, player]);

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const isBuffering = status === 'loading';

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!video || isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Experience not found</Text>
        </View>
      </View>
    );
  }

  const displayName = video.owner?.displayName ?? 'Unknown Videographer';
  const timeAgo = formatTimeAgo(video.createdAt);

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleSave() {
    setSaved((v) => !v);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = video?.publicUrl;
    if (!url) {
      Alert.alert('Not available', 'No Experience URL to share.');
      return;
    }
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(url);
      } else {
        await Share.share({ url, message: video.title ?? 'Check out this Glassnik Experience!' });
      }
    } catch {
      // user cancelled share sheet — ignore
    }
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerLabel, { color: colors.foreground }]} numberOfLines={1}>
          @{video.owner?.username ?? (video.owner?.displayName ?? 'videographer').toLowerCase().replace(/\s+/g, '')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Video player ── */}
        <View style={[styles.playerWrap, { backgroundColor: '#000' }]}>
          {videoUri ? (
            <VideoView
              player={player}
              style={styles.videoView}
              allowsFullscreen
              allowsPictureInPicture={Platform.OS !== 'web'}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.videoView, styles.noVideoPlaceholder]}>
              <Feather name="film" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.noVideoText}>No Experience available</Text>
            </View>
          )}
          {isBuffering && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>

        {/* ── Actions bar ── */}
        <View style={[styles.actions, { borderColor: colors.border }]}>
          <ActionBtn
            icon="heart"
            label={liked ? `${likeCount}` : 'Like'}
            active={liked}
            onPress={handleLike}
            colors={colors}
          />
          <ActionBtn
            icon="bookmark"
            label="Save"
            active={saved}
            onPress={handleSave}
            colors={colors}
          />
          <ActionBtn
            icon="share-2"
            label="Share"
            active={false}
            onPress={handleShare}
            colors={colors}
          />
        </View>

        {/* ── Video info ── */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {video.title ?? 'Untitled'}
          </Text>

          {/* Creator row — tappable to view profile */}
          <Pressable
            style={({ pressed }) => [
              styles.creatorRow,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => {
              if (video.owner?.id != null) {
                router.push(`/user/${video.owner.id}` as any);
              }
            }}
          >
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.creatorName, { color: colors.foreground }]}>{displayName}</Text>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo}</Text>
            </View>
            {video.owner?.id != null && (
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            )}
          </Pressable>

          {video.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {video.description}
            </Text>
          ) : null}

          {/* Tags */}
          {(video.source || video.status || video.duration) ? (
            <View style={styles.tags}>
              {video.duration ? (
                <Tag label={`${formatDuration(video.duration)}`} icon="clock" colors={colors} />
              ) : null}
              {video.source ? <Tag label={video.source} icon="layers" colors={colors} /> : null}
              {video.status ? <Tag label={video.status} icon="activity" colors={colors} /> : null}
            </View>
          ) : null}
        </View>

        {/* ── Comments placeholder ── */}
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
          <View style={styles.commentsSectionHeader}>
            <Feather name="message-circle" size={16} color={colors.primary} />
            <Text style={[styles.commentsSectionTitle, { color: colors.foreground }]}>Comments</Text>
          </View>
          <View style={styles.commentsEmpty}>
            <Text style={[styles.commentsEmptyText, { color: colors.mutedForeground }]}>
              No comments yet. Be the first!
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ──

function ActionBtn({
  icon, label, active, onPress, colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon} size={22} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.actionLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Tag({
  label, icon, colors,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Feather name={icon} size={10} color={colors.mutedForeground} />
      <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ── Helpers ──

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Styles ──

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  scroll: { gap: 0 },

  // Player
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoView: { width: '100%', height: '100%' },
  noVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#111',
  },
  noVideoText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  actionLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // Info
  info: { padding: 20, gap: 14 },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  creatorName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  time: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  description: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // Comments
  commentsSection: { borderTopWidth: 1, padding: 20, gap: 12 },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentsSectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  commentsEmpty: { paddingVertical: 16, alignItems: 'center' },
  commentsEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});