import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@/context/AuthContext';
import { DesktopAppShell } from '@/components/DesktopAppShell';
import { TopNav } from '@/components/TopNav';
import { userApi, videoApi } from '@/lib/api';
import type { VideoItem } from '@/types';

type GridTab = 'videos' | 'liked';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatMemberSince(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [gridTab, setGridTab] = useState<GridTab>('videos');

  // ── Inline profile editing ──
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setEditDisplayName(user?.displayName ?? '');
    setEditUsername(user?.username ?? '');
  }, [user]);

  function handleStartEdit() {
    setEditDisplayName(user?.displayName ?? '');
    setEditUsername(user?.username ?? '');
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await updateUser({
        displayName: editDisplayName.trim() || undefined,
        username: editUsername.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save changes.');
    } finally {
      setSavingProfile(false);
    }
  }

  const { data: capabilities } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: userApi.getMyCapabilities,
    enabled: !!user,
    retry: false,
  });

  const { data: rawVideos, isLoading: videosLoading } = useQuery({
    queryKey: ['user-videos', user?.id],
    queryFn: () => videoApi.getUserVideos(user!.id),
    enabled: !!user,
    retry: 1,
    refetchInterval: (query) => {
      const data = (query.state as any).data;
      const all: VideoItem[] = Array.isArray(data) ? data : (data?.data ?? data?.videos ?? []);
      const hasProcessing = all.some(
        (v) => v.status === 'pending' || v.status === 'inprogress' || v.status === 'pendingupload',
      );
      return hasProcessing ? 5000 : false;
    },
  });

  const { data: profileStats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: userApi.getMe,
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // Refetch stats whenever this screen comes into focus so follow/unfollow
  // actions performed on other screens are immediately reflected.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['profile-stats', user.id] });
      }
    }, [user, queryClient])
  );

  // Handle both array and paginated response shapes
  const allVideos: VideoItem[] = Array.isArray(rawVideos)
    ? rawVideos
    : (rawVideos?.data ?? rawVideos?.videos ?? []);

  // Split into processing (pending/inprogress), failed, and ready-to-view
  const normaliseStatus = (status?: string | null) =>
  (status ?? '').toLowerCase().replace(/_/g, '');

const processingVideos = allVideos.filter((v) => {
  const status = normaliseStatus(v.status);
  return status === 'pending' ||
         status === 'inprogress' ||
         status === 'pendingupload';
});

const errorVideos = allVideos.filter(
  (v) => normaliseStatus(v.status) === 'error'
);

const videos = allVideos.filter((v) => {
  const status = normaliseStatus(v.status);
  return status === 'published' || status === 'ready';
});

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 12;
  const displayName = user?.displayName ?? user?.username ?? user?.email ?? 'User';
  const username = user?.username ?? (user?.email?.split('@')[0]) ?? 'user';

  const stats = {
    following: profileStats?.followingCount != null ? formatCount(profileStats.followingCount) : '—',
    followers: profileStats?.followerCount  != null ? formatCount(profileStats.followerCount)  : '—',
    likes:     profileStats?.likeCount      != null ? formatCount(profileStats.likeCount)      : '—',
  };

  // These fields aren't declared on the `User` type, but /users/me is typed
  // as `any`, so the real backend response may include them. Rendered only
  // when present — nothing fabricated if the backend doesn't send them yet.
  const bio: string | null = (profileStats as any)?.bio ?? null;
  const location: string | null =
    (profileStats as any)?.location ??
    [(profileStats as any)?.city, (profileStats as any)?.country].filter(Boolean).join(', ') ??
    null;
  const memberSince = formatMemberSince((profileStats as any)?.createdAt ?? (user as any)?.createdAt);

  const CELL_SIZE = (width - 3) / 3;

  async function handleDeleteErrorVideo(video: VideoItem) {
    const MAX_ERROR_LEN = 120;
    const rawError = video.errorMessage?.trim();
    const errorDetail = rawError
      ? rawError.length > MAX_ERROR_LEN
        ? rawError.slice(0, MAX_ERROR_LEN) + '…'
        : rawError
      : null;
    const body = errorDetail
      ? `"${video.title ?? 'Untitled'}" failed to process.\n\nReason: ${errorDetail}\n\nDelete this video and re-upload it to try again.`
      : `"${video.title ?? 'Untitled'}" failed to process.\n\nDelete this video and re-upload it to try again.`;
    Alert.alert(
      'Upload Failed',
      body,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Re-upload',
          style: 'destructive',
          onPress: async () => {
            try {
              await videoApi.deleteVideo(video.id);
              queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id] });
              queryClient.invalidateQueries({ queryKey: ['my-videos', user?.id] });
            } catch {
              Alert.alert('Error', 'Could not delete the video. Please try again.');
            }
          },
        },
      ],
    );
  }

  function navigateToVideo(video: VideoItem) {
    router.push({ pathname: '/video/[id]' as any, params: { id: video.id, data: JSON.stringify(video) } });
  }

  return (
    <DesktopAppShell>
        {Platform.OS === 'web' && isMobile && <TopNav />}
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        stickyHeaderIndices={[1]}
      >
        {/* ── Cover area ── */}
        <View style={[styles.cover, { paddingTop: topPad }]}>
          {/* Header row: back (empty), username, settings icon */}
          <View style={styles.coverHeader}>
            <View style={{ width: 36 }} />
            <Text style={styles.coverUsername}>@{username}</Text>
            <Pressable
              onPress={() => router.push('/settings' as any)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather name="settings" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Avatar removed per spec — @username is the sole identifier
              used throughout the viewer experience. Edit Profile button
              below still opens the same inline edit mode. */}
          <View style={styles.avatarSection}>
            {isEditing ? (
              <View style={styles.editFields}>
                <View style={styles.editField}>
                  <Text style={styles.editFieldLabel}>Display Name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editDisplayName}
                    onChangeText={setEditDisplayName}
                    placeholder="Your display name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editFieldLabel}>Username</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="username"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.editActionRow}>
                  <Pressable
                    style={[styles.editActionBtn, styles.editCancelBtn]}
                    onPress={handleCancelEdit}
                    disabled={savingProfile}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.editActionBtn, styles.editSaveBtn]}
                    onPress={handleSaveEdit}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.displayName}>{displayName}</Text>
                <Text style={styles.roleLabel}>Eye-POV Videographer</Text>

                {/* Location / Member since — only shown when the backend provides them */}
                {(location || memberSince) && (
                  <View style={styles.metaRow}>
                    {location ? (
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.metaText}>{location}</Text>
                      </View>
                    ) : null}
                    {memberSince ? (
                      <View style={styles.metaItem}>
                        <Feather name="calendar" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.metaText}>Member since {memberSince}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Bio — only shown when the backend provides it */}
                {bio ? <Text style={styles.bioText}>{bio}</Text> : null}

                {/* Stats */}
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
                    <Text style={styles.statLabel}>Total Views</Text>
                  </View>
                </View>

                {/* Action buttons — logout icon removed from here per spec;
                    it now lives in the hamburger menu (TopNav.tsx) instead.
                    My Videos button now shows a visible "Videos" label next
                    to the icon, since the icon alone wasn't identifiable. */}
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.editProfileBtn}
                    onPress={handleStartEdit}
                  >
                    <Text style={styles.editProfileText}>Edit profile</Text>
                  </Pressable>
                  <Pressable
                    style={styles.myVideosBtn}
                    onPress={() => router.push('/my-videos' as any)}
                  >
                    <Feather name="film" size={16} color="#fff" />
                    <Text style={styles.myVideosBtnText}>Videos</Text>
                  </Pressable>
                </View>

                {/* Capability badges — always shows "Videographer" rather than
                    the raw internal capability name (e.g. "mobile.creator"),
                    which should never be exposed to users. */}
                {capabilities && capabilities.length > 0 && (
                  <View style={styles.capRow}>
                    {capabilities.map((cap: any) => (
                      <View key={cap.id} style={styles.capBadge}>
                        <Text style={styles.capBadgeText}>Videographer</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Processing videos ── */}
        {(processingVideos.length > 0 || errorVideos.length > 0) && (
          <View style={styles.processingSection}>
            <View style={styles.processingSectionHeader}>
              {processingVideos.length > 0 && (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              )}
              {processingVideos.length === 0 && errorVideos.length > 0 && (
                <Feather name="alert-circle" size={14} color="#ef4444" />
              )}
              <Text style={styles.processingSectionTitle}>
                {processingVideos.length > 0 ? 'Processing' : 'Upload Failed'}
              </Text>
              <Text style={styles.processingSectionHint}>
                {processingVideos.length > 0
                  ? processingVideos.length === 1
                    ? '1 video encoding…'
                    : `${processingVideos.length} videos encoding…`
                  : errorVideos.length === 1
                  ? '1 video failed'
                  : `${errorVideos.length} videos failed`}
              </Text>
            </View>
            {processingVideos.map((video) => {
              const statusLabel =
                video.status === 'pendingupload'
                  ? 'Uploading'
                  : video.status === 'pending'
                  ? 'Queued'
                  : 'Encoding';
              return (
                <Pressable
                  key={video.id}
                  style={({ pressed }) => [
                    styles.processingItem,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() =>
                    Alert.alert(
                      video.title ?? 'Processing video',
                      `Status: ${statusLabel}\n\nCloudflare is encoding your video. This usually takes under a minute. Your video will appear in the feed once it's ready.`,
                      [{ text: 'OK' }],
                    )
                  }
                >
                  <View style={styles.processingThumb}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                  </View>
                  <View style={styles.processingInfo}>
                    <Text style={styles.processingTitle} numberOfLines={1}>
                      {video.title ?? 'Untitled'}
                    </Text>
                    <View style={styles.processingStatusRow}>
                      <View style={styles.processingDot} />
                      <Text style={styles.processingStatus}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
                </Pressable>
              );
            })}
            {errorVideos.map((video) => (
              <Pressable
                key={video.id}
                style={({ pressed }) => [
                  styles.processingItem,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => handleDeleteErrorVideo(video)}
              >
                <View style={[styles.processingThumb, styles.errorThumb]}>
                  <Feather name="alert-circle" size={20} color="#ef4444" />
                </View>
                <View style={styles.processingInfo}>
                  <Text style={styles.processingTitle} numberOfLines={1}>
                    {video.title ?? 'Untitled'}
                  </Text>
                  <View style={styles.processingStatusRow}>
                    <View style={[styles.processingDot, styles.errorDot]} />
                    <Text style={[styles.processingStatus, styles.errorStatus]}>
                      Processing failed
                    </Text>
                  </View>
                </View>
                <Feather name="trash-2" size={15} color="rgba(239,68,68,0.6)" />
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Sticky grid tabs ── */}
        <View style={styles.gridTabs}>
          <Pressable
            style={[styles.gridTab, gridTab === 'videos' && styles.gridTabActive]}
            onPress={() => setGridTab('videos')}
          >
            <Feather name="grid" size={20} color={gridTab === 'videos' ? '#fff' : 'rgba(255,255,255,0.4)'} />
          </Pressable>
          <Pressable
            style={[styles.gridTab, gridTab === 'liked' && styles.gridTabActive]}
            onPress={() => setGridTab('liked')}
          >
            <Feather name="heart" size={20} color={gridTab === 'liked' ? '#fff' : 'rgba(255,255,255,0.4)'} />
          </Pressable>
        </View>

        {/* ── Video grid ── */}
        {gridTab === 'videos' && (
          <>
            {videosLoading ? (
              <View style={styles.gridLoader}>
                <ActivityIndicator color="rgba(255,255,255,0.4)" />
              </View>
            ) : videos.length === 0 ? (
              <View style={styles.gridEmpty}>
                <Feather name="video-off" size={36} color="rgba(255,255,255,0.15)" />
                {processingVideos.length > 0 ? (
                  <>
                    <Text style={styles.gridEmptyText}>Your first Eye-POV experience is being reviewed</Text>
                    <Text style={styles.gridEmptySub}>
                      Most Experiences are reviewed within 1 hour, although reviews may take up to 24 hours during busy periods.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.gridEmptyText}>No Experiences yet</Text>
                    <Text style={styles.gridEmptySub}>Upload your first Experience from the + tab.</Text>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.grid}>
                {videos.map((video, idx) => {
                  const colors = ['#FF6B9D', '#FF4500', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
                  const color = colors[video.id % colors.length] ?? '#7C3AED';
                  const initial = (video.title ?? 'V').charAt(0).toUpperCase();
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
                      {(video as any).thumbnailUrl ? (
                        <Image
                          source={{ uri: (video as any).thumbnailUrl }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <>
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.25 }]} />
                          <Text style={[styles.gridCellInitial, { color }]}>{initial}</Text>
                        </>
                      )}
                      <View style={styles.gridCellScrim} />
                      <View style={styles.gridCellLikes}>
                        <Feather name="eye" size={10} color="#fff" />
                        <Text style={styles.gridCellLikeText}>
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
          </>
        )}

        {gridTab === 'liked' && (
          <View style={styles.gridEmpty}>
            <Feather name="heart" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={styles.gridEmptyText}>Liked Experiences</Text>
            <Text style={styles.gridEmptySub}>Experiences you've liked will appear here.</Text>
          </View>
        )}
      </ScrollView>
      </View>
    </DesktopAppShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

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

  // Avatar section retained as a wrapper (no avatar itself), holding the
  // display name / role / meta / stats / actions.
  avatarSection: { alignItems: 'center', paddingHorizontal: 20, gap: 10 },
  displayName: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 8 },
  roleLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_400Regular' },

  bioText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginTop: 8 },
  statItem: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 4 },
  statNum: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editProfileBtn: {
    flex: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
  },
  editProfileText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  // My Videos button — now shows icon + "Videos" label so its purpose is
  // clear, instead of an unlabeled icon-only button.
  myVideosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  myVideosBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Inline edit mode
  editFields: { width: '100%', gap: 12, marginTop: 4 },
  editField: { gap: 6 },
  editFieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    height: 44,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  editActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editCancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  editSaveBtn: { backgroundColor: '#fff' },
  editSaveText: { color: '#000', fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Capability badges
  capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  capBadge: {
    backgroundColor: 'rgba(254,44,85,0.2)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.5)',
  },
  capBadgeText: { color: '#FE2C55', fontSize: 11, fontFamily: 'Inter_600SemiBold' },

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
  gridCellLikes: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridCellLikeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Processing section
  processingSection: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  processingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  processingSectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  processingSectionHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  processingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  processingThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  processingInfo: {
    flex: 1,
    gap: 4,
  },
  processingTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  processingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  processingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FE2C55',
  },
  processingStatus: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  errorThumb: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorDot: {
    backgroundColor: '#ef4444',
  },
  errorStatus: {
    color: '#ef4444',
  },

  // Grid loading / empty
  gridLoader: { height: 180, alignItems: 'center', justifyContent: 'center' },
  gridEmpty: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  gridEmptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  gridEmptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});