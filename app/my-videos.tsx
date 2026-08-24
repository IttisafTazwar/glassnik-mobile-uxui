import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { videoApi } from '@/lib/api';
import type { VideoItem } from '@/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.glassnik.com';

// Matches the category list used on Explore and Upload.
const EDIT_CATEGORIES = [
  'City Walks',
  'Local Life',
  'Food & Markets',
  'Nature & Scenery',
  'Beaches & Coastlines',
  'Architecture & Landmarks',
  'Attractions',
  'Hidden Gems',
  'Peaceful Places',
  'Cafes',
  'Shopping',
  'Museums & Galleries',
  'Parks & Gardens',
  'Trails & Hiking',
  'Adventure',
  'Rides & Transport',
  'Scenic Drives',
  'Sports',
  'Events & Festivals',
  'Music & Performance',
  'Sacred Places',
  'After Dark',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: 'Published', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  ready:     { label: 'Ready',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  live:      { label: 'Live',      color: '#FE2C55', bg: 'rgba(254,44,85,0.12)' },
  processing:{ label: 'Processing',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  pending:   { label: 'Pending Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  failed:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function getStatusConfig(status?: string | null) {
  if (!status) return { label: 'Unknown', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' };
  return STATUS_CONFIG[status.toLowerCase()] ?? { label: status, color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' };
}

function isPendingStatus(status?: string | null): boolean {
  return (status ?? '').toLowerCase() === 'pending';
}

function formatCount(n: number | null | undefined): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Upload an image file to object storage and return the public serving URL. */
async function uploadThumbnail(
  uri: string,
  mimeType: string,
  fileName: string,
  accessToken: string,
): Promise<string> {
  // 1) Get the file bytes as a blob
  const blobRes = await fetch(uri);
  const blob = await blobRes.blob();

  // 2) Request a presigned URL
  const urlRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: fileName, size: blob.size, contentType: mimeType }),
  });
  if (!urlRes.ok) throw new Error('Could not get upload URL');
  const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

  // 3) PUT directly to GCS
  const putRes = await fetch(uploadURL, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': mimeType },
  });
  if (!putRes.ok) throw new Error('Failed to upload thumbnail');

  // 4) Return serving URL
  return `${API_BASE}/storage${objectPath}`;
}

export default function MyVideosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingThumbId, setUploadingThumbId] = useState<number | null>(null);

  // ── Edit panel (Title/Description/Location/Category) for pending videos ──
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: rawData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['my-videos', user?.id],
    queryFn: () => videoApi.getUserVideos(user!.id),
    enabled: !!user,
    retry: 1,
  });

  const videos: VideoItem[] = Array.isArray(rawData)
    ? rawData
    : ((rawData as any)?.data ?? (rawData as any)?.videos ?? []);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => videoApi.deleteVideo(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['my-videos', user?.id], (old: any) => {
        if (Array.isArray(old)) return old.filter((v: VideoItem) => v.id !== id);
        if (old?.data) return { ...old, data: old.data.filter((v: VideoItem) => v.id !== id) };
        return old;
      });
    },
    onError: (err: any) => {
      Alert.alert('Delete failed', err?.message ?? 'Could not delete video.');
    },
  });

  function confirmDelete(video: VideoItem) {
    Alert.alert(
      'Delete video',
      `Delete "${video.title ?? 'this video'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingId(video.id);
            deleteMutation.mutate(video.id, { onSettled: () => setDeletingId(null) });
          },
        },
      ],
    );
  }

  async function handleChangeThumbnail(video: VideoItem) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to change the thumbnail.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const fileName = asset.fileName ?? `thumbnail_${video.id}.jpg`;

    setUploadingThumbId(video.id);
    try {
      const thumbUrl = await uploadThumbnail(asset.uri, mimeType, fileName, token ?? '');

      // PATCH video with new thumbnailUrl
      const patchRes = await fetch(`${API_BASE}/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ thumbnailUrl: thumbUrl }),
      });
      if (!patchRes.ok) throw new Error('Failed to save thumbnail');

      // Update cache
      queryClient.setQueryData(['my-videos', user?.id], (old: any) => {
        const patch = (v: VideoItem) => v.id === video.id ? { ...v, thumbnailUrl: thumbUrl } : v;
        if (Array.isArray(old)) return old.map(patch);
        if (old?.data) return { ...old, data: old.data.map(patch) };
        return old;
      });
      Alert.alert('Thumbnail updated!', 'Your new thumbnail has been saved.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload thumbnail.');
    } finally {
      setUploadingThumbId(null);
    }
  }

  function openEditPanel(video: VideoItem) {
    setEditTitle(video.title ?? '');
    setEditDescription((video as any).description ?? '');
    setEditLocation((video as any).place ?? (video as any).location ?? '');
    setEditCategory((video as any).category ?? null);
    setEditingVideo(video);
  }

  function closeEditPanel() {
    setEditingVideo(null);
  }

  async function handleSaveEdit() {
    if (!editingVideo || savingEdit) return;
    setSavingEdit(true);
    try {
      // NOTE: mirrors the existing thumbnail PATCH call above. Not yet
      // confirmed the backend accepts these specific fields — same caveat
      // as Location/Category on the Upload form.
      const patchRes = await fetch(`${API_BASE}/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          location: editLocation.trim(),
          category: editCategory,
        }),
      });
      if (!patchRes.ok) throw new Error('Failed to save changes');

      queryClient.setQueryData(['my-videos', user?.id], (old: any) => {
        const patch = (v: VideoItem) =>
          v.id === editingVideo.id
            ? { ...v, title: editTitle.trim(), description: editDescription.trim() }
            : v;
        if (Array.isArray(old)) return old.map(patch);
        if (old?.data) return { ...old, data: old.data.map(patch) };
        return old;
      });

      Alert.alert('Saved', 'Your changes have been saved.');
      setEditingVideo(null);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  function showStatusDetail(video: VideoItem) {
    const sc = getStatusConfig(video.status);
    const pending = isPendingStatus(video.status);
    Alert.alert(
      sc.label,
      pending
        ? `Submitted ${timeAgo(video.createdAt)} ago. Every video is manually reviewed to ensure it meets Glassnik's Eye-POV standards. Most videos are published within 1 hour, although reviews may take up to 24 hours during busy periods.`
        : `Status: ${sc.label}`,
      [{ text: 'OK' }],
    );
  }

  function showVideoOptions(video: VideoItem) {
    const pending = isPendingStatus(video.status);
    const options: any[] = [];

    if (pending) {
      options.push({ text: 'Edit', onPress: () => openEditPanel(video) });
    }
    options.push({ text: 'View Status', onPress: () => showStatusDetail(video) });
    options.push({ text: 'Change thumbnail', onPress: () => handleChangeThumbnail(video) });
    options.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDelete(video) });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(video.title ?? 'Video options', undefined, options);
  }

  const renderItem = useCallback(({ item }: { item: VideoItem }) => {
    const sc = getStatusConfig(item.status);
    const pending = isPendingStatus(item.status);
    const isDeleting = deletingId === item.id;
    const isUploadingThumb = uploadingThumbId === item.id;

    return (
      <View>
        <Pressable
          onPress={() => !isDeleting && router.push({ pathname: '/video/[id]' as any, params: { id: item.id, data: JSON.stringify(item) } })}
          onLongPress={() => showVideoOptions(item)}
          style={[styles.row, isDeleting && { opacity: 0.4 }]}
        >
          {/* Thumbnail — tap opens picker, not the video */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); handleChangeThumbnail(item); }}
            style={styles.thumbWrapper}
          >
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbInitial}>
                  {(item.title ?? 'V').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Pending Review overlay — shown over either a real thumbnail or the placeholder */}
            {pending && (
              <View style={styles.pendingOverlay}>
                <Feather name="clock" size={12} color="#f59e0b" />
                <Text style={styles.pendingOverlayText}>Pending Review</Text>
              </View>
            )}

            {/* Edit overlay */}
            <View style={styles.thumbEditOverlay}>
              {isUploadingThumb ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={12} color="rgba(255,255,255,0.9)" />
              )}
            </View>
          </Pressable>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.title ?? 'Untitled'}</Text>

            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>

            {pending ? (
              <Text style={styles.submittedText}>Submitted: {timeAgo(item.createdAt)} ago</Text>
            ) : (
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Feather name="eye" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>{formatCount(item.viewCount)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="heart" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>{formatCount(item.likeCount)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="message-circle" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaText}>{formatCount(item.commentCount)}</Text>
                </View>
                <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
              </View>
            )}
          </View>

          {/* More options button */}
          <Pressable
            onPress={() => !isDeleting && showVideoOptions(item)}
            hitSlop={8}
            style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
            ) : (
              <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.35)" />
            )}
          </Pressable>
        </Pressable>

        {/* Review-time disclaimer — shown once per pending item */}
        {pending && (
          <Text style={styles.disclaimerText}>
            Every video is manually reviewed to ensure it meets Glassnik's Eye-POV standards. Most videos are published within 1 hour, although reviews may take up to 24 hours during busy periods.
          </Text>
        )}
      </View>
    );
  }, [deletingId, uploadingThumbId]);

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 12;

  // ── Edit panel screen (replaces the list while active) ──
  if (editingVideo) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable onPress={closeEditPanel} hitSlop={12} style={styles.backBtn}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Video</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.editScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Title</Text>
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Give your video a title…"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextarea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Describe what's in this video…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Location</Text>
            <TextInput
              style={styles.editInput}
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Where was this filmed?"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editCategoryRow}>
              {EDIT_CATEGORIES.map((cat) => {
                const isActive = editCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setEditCategory(cat)}
                    style={[styles.editCategoryPill, isActive && styles.editCategoryPillActive]}
                  >
                    <Text style={[styles.editCategoryPillText, isActive && styles.editCategoryPillTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.editActionRow}>
            <Pressable style={[styles.editActionBtn, styles.editCancelBtn]} onPress={closeEditPanel} disabled={savingEdit}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.editActionBtn, styles.editSaveBtn]} onPress={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.editSaveText}>Save</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>My Videos</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Could not load videos.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Feather name="video-off" size={40} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No videos yet</Text>
          <Text style={styles.emptySub}>Upload your first video from the + tab.</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor="rgba(255,255,255,0.5)"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  emptySub: { color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  separator: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginLeft: 86 },

  thumbWrapper: {
    width: 56,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  thumbImage: { width: 56, height: 72 },
  thumbPlaceholder: {
    width: 56,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontFamily: 'Inter_700Bold' },
  thumbEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pendingOverlayText: {
    color: '#f59e0b',
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },

  info: { flex: 1, gap: 6 },
  title: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  submittedText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  timeText: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 'auto' },

  disclaimerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingLeft: 86,
  },

  moreBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Edit panel
  editScroll: { padding: 20, gap: 16 },
  editField: { gap: 6, marginBottom: 4 },
  editFieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    height: 46,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  editTextarea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  editCategoryRow: { gap: 8, paddingRight: 4 },
  editCategoryPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editCategoryPillActive: { backgroundColor: '#FE2C55', borderColor: '#FE2C55' },
  editCategoryPillText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  editCategoryPillTextActive: { color: '#fff' },
  editActionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editActionBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editCancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  editCancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  editSaveBtn: { backgroundColor: '#fff' },
  editSaveText: { color: '#000', fontSize: 14, fontFamily: 'Inter_700Bold' },
});