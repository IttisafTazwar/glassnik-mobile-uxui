import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { userApi, videoApi } from '@/lib/api';
import type { VideoItem } from '@/types';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UserProfileScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const userId = parseInt(String(idParam ?? ''), 10);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userApi.getUser(userId),
    enabled: !isNaN(userId),
    staleTime: 30_000,
    retry: 1,
  });

  // Refresh profile stats when the screen comes into focus (e.g. after follow/unfollow)
  useFocusEffect(
    useCallback(() => {
      if (!isNaN(userId)) {
        queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
        queryClient.invalidateQueries({ queryKey: ['user-videos-public', userId] });
      }
    }, [userId, queryClient])
  );

  const { data: rawVideos, isLoading: videosLoading } = useQuery({
    queryKey: ['user-videos-public', userId],
    queryFn: () => videoApi.getUserVideos(userId),
    enabled: !isNaN(userId),
    retry: 1,
  });

  const videos: VideoItem[] = Array.isArray(rawVideos)
    ? rawVideos
    : (rawVideos?.data ?? rawVideos?.videos ?? []);

  // Follow / unfollow mutation — optimistic update on followerCount + isFollowing
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  // Sync local state once profile data arrives
  React.useEffect(() => {
    if (profile) {
      if (isFollowing === null) setIsFollowing(profile.isFollowing ?? false);
      if (followerCount === null) setFollowerCount(profile.followerCount ?? 0);
    }
  }, [profile]);

  const followMutation = useMutation({
    mutationFn: (following: boolean) =>
      following ? userApi.follow(userId) : userApi.unfollow(userId),
    onMutate: (following) => {
      setIsFollowing(following);
      setFollowerCount((c) => (c ?? 0) + (following ? 1 : -1));
    },
    onSuccess: (data) => {
      setFollowerCount(data.followerCount);
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    },
    onError: (_err, following) => {
      // Revert
      setIsFollowing(!following);
      setFollowerCount((c) => (c ?? 0) + (following ? -1 : 1));
    },
  });

  function handleFollowPress() {
    if (!me) { router.push('/auth/login' as any); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    followMutation.mutate(!(isFollowing ?? false));
  }

  function navigateToVideo(video: VideoItem) {
    router.push(`/video/${video.id}` as any);
  }

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 12;
  const CELL_SIZE = (width - 3) / 3;

  if (isNaN(userId)) {
    return (
      <View style={styles.root}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color="rgba(255,255,255,0.4)" />
          <Text style={styles.errorText}>Invalid user</Text>
        </View>
      </View>
    );
  }

  if (profileLoading) {
    return (
      <View style={styles.root}>
        <View style={[styles.coverHeader, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color="rgba(255,255,255,0.5)" />
        </View>
      </View>
    );
  }

  if (profileError || !profile) {
    return (
      <View style={styles.root}>
        <View style={[styles.coverHeader, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="user-x" size={36} color="rgba(255,255,255,0.2)" />
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </View>
    );
  }

  const displayName = profile.displayName ?? profile.username ?? 'User';
  const username = profile.username ?? 'user';
  const initial = displayName.charAt(0).toUpperCase();
  const isOwnProfile = me?.id === userId;

  const stats = {
    following: followerCount !== null
      ? formatCount(profile.followingCount ?? 0)
      : profile.followingCount != null ? formatCount(profile.followingCount) : '—',
    followers: followerCount !== null
      ? formatCount(followerCount)
      : profile.followerCount != null ? formatCount(profile.followerCount) : '—',
    likes: profile.likeCount != null ? formatCount(profile.likeCount) : '—',
  };

  const displayIsFollowing = isFollowing !== null ? isFollowing : (profile.isFollowing ?? false);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        stickyHeaderIndices={[1]}
      >
        {/* ── Cover area ── */}
        <View style={[styles.cover, { paddingTop: topPad }]}>
          {/* Header row: back, username */}
          <View style={styles.coverHeader}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.coverUsername}>@{username}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Avatar + info */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.displayName}>{displayName}</Text>

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.likes}</Text>
                <Text style={styles.statLabel}>Likes</Text>
              </View>
            </View>

            {/* Action button */}
            {!isOwnProfile && (
              <View style={styles.actionRow}>
                <Pressable
                  style={[
                    styles.followBtn,
                    displayIsFollowing ? styles.followingBtn : styles.notFollowingBtn,
                  ]}
                  onPress={handleFollowPress}
                  disabled={followMutation.isPending}
                >
                  {followMutation.isPending ? (
                    <ActivityIndicator size="small" color={displayIsFollowing ? '#fff' : '#000'} />
                  ) : (
                    <Text
                      style={[
                        styles.followBtnText,
                        displayIsFollowing ? styles.followingBtnText : styles.notFollowingBtnText,
                      ]}
                    >
                      {displayIsFollowing ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ── Sticky grid tab bar ── */}
        <View style={styles.gridTabs}>
          <View style={[styles.gridTab, styles.gridTabActive]}>
            <Feather name="grid" size={20} color="#fff" />
          </View>
        </View>

        {/* ── Video grid ── */}
        {videosLoading ? (
          <View style={styles.gridLoader}>
            <ActivityIndicator color="rgba(255,255,255,0.4)" />
          </View>
        ) : videos.length === 0 ? (
          <View style={styles.gridEmpty}>
            <Feather name="video-off" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={styles.gridEmptyText}>No videos yet</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {videos.map((video, idx) => {
              const colors = ['#FF6B9D', '#FF4500', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
              const color = colors[video.id % colors.length] ?? '#7C3AED';
              const cellInitial = (video.title ?? 'V').charAt(0).toUpperCase();
              return (
                <Pressable
                  key={video.id}
                  onPress={() => navigateToVideo(video)}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { width: CELL_SIZE, height: CELL_SIZE * 1.5, opacity: pressed ? 0.8 : 1 },
                    idx % 3 !== 2 ? { marginRight: 1.5 } : {},
                  ]}
                >
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.25 }]} />
                  <Text style={[styles.gridCellInitial, { color }]}>{cellInitial}</Text>
                  <View style={styles.gridCellScrim} />
                  <View style={styles.gridCellMeta}>
                    <Feather name="eye" size={10} color="#fff" />
                    <Text style={styles.gridCellMetaText}>
                      {video.viewCount != null
                        ? video.viewCount >= 1_000
                          ? `${(video.viewCount / 1000).toFixed(0)}K`
                          : String(video.viewCount)
                        : '0'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {videos.length % 3 !== 0 && (
              <View style={{ width: CELL_SIZE * (3 - (videos.length % 3)), height: CELL_SIZE * 1.5 }} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontFamily: 'Inter_400Regular' },

  // Cover
  cover: {
    backgroundColor: '#000',
    paddingBottom: 8,
  },
  coverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  coverUsername: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  // Avatar
  avatarSection: { alignItems: 'center', paddingHorizontal: 20, gap: 10 },
  avatarWrap: {},
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FE2C55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 36, fontFamily: 'Inter_700Bold' },
  displayName: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },

  // Stats — identical layout to own-profile stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  statItem: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 4 },
  statNum: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Follow button
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  followBtn: {
    height: 36,
    paddingHorizontal: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  notFollowingBtn: {
    backgroundColor: '#FE2C55',
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  followBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  notFollowingBtnText: { color: '#fff' },
  followingBtnText: { color: '#fff' },

  // Grid tabs
  gridTabs: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
  },
  gridTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  gridTabActive: { borderBottomColor: '#fff' },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    marginTop: 1.5,
  },
  gridCell: {
    backgroundColor: '#111',
    marginBottom: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellInitial: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    opacity: 0.8,
  },
  gridCellScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridCellMeta: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridCellMetaText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Grid loading / empty
  gridLoader: { height: 180, alignItems: 'center', justifyContent: 'center' },
  gridEmpty: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  gridEmptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
