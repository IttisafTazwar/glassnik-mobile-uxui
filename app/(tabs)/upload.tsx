import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { mobileApi, userApi, videoApi } from '@/lib/api';
import { useUploadGuard } from '@/context/UploadGuardContext';

// ─── Notification handler (must be set before any schedule call) ──────────────


// ─── Upload transport ─────────────────────────────────────────────────────────
// The backend returns a Google Cloud Storage V4 signed URL. It is a normal
// signed object upload URL, not a TUS resumable endpoint.

// ─── Component ────────────────────────────────────────────────────────────────

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function UploadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string>('');
  const [pickedSize, setPickedSize] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0); // 0–1
  const [statusMsg, setStatusMsg] = useState('');

  const navigation = useNavigation();
  const { setGuardActive, cancelUploadRef, intentionalLeaveRef } = useUploadGuard();

  const uploadTaskRef = useRef<LegacyFS.UploadTask | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for mobile.creator capability
  const { data: capabilities, isLoading: capsLoading } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: userApi.getMyCapabilities,
    enabled: !!user,
  });

  // Poll for previously uploaded videos still being processed (survives navigation)
  const { data: rawMyVideos } = useQuery({
    queryKey: ['my-videos', user?.id],
    queryFn: () => videoApi.getUserVideos(user!.id),
    enabled: !!user && !capsLoading,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = (query.state as any).data;
      const all = Array.isArray(data) ? data : (data?.data ?? data?.videos ?? []);
      const hasProcessing = all.some(
        (v: any) =>
          v.status === 'pending' || v.status === 'inprogress' || v.status === 'pendingupload',
      );
      return hasProcessing ? 5000 : false;
    },
  });

  const allMyVideos: any[] = Array.isArray(rawMyVideos)
    ? rawMyVideos
    : ((rawMyVideos as any)?.data ?? (rawMyVideos as any)?.videos ?? []);

  // Videos from prior sessions that are still encoding (not the current active upload)
  const serverProcessingVideos = allMyVideos.filter(
    (v: any) =>
      v.status === 'pending' || v.status === 'inprogress' || v.status === 'pendingupload',
  );

  // Videos that failed Cloudflare encoding
  const serverErrorVideos = allMyVideos.filter((v: any) => v.status === 'error');

  const hasCreatorCap = capabilities?.some(
    (c: any) => c.capability?.name === 'mobile.creator' && c.status === 'ACTIVE',
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isUploading = phase === 'uploading' || phase === 'processing';


  // ── Sync isUploading → context guard (consumed by tab bar buttons) ──────────
  useEffect(() => {
    setGuardActive(isUploading);
    return () => setGuardActive(false);
  }, [isUploading]);

  // ── Register cancel callback for the context guard ────────────────────────
  // Uses refs + stable setters so the effect never needs to re-run.
  useEffect(() => {
    cancelUploadRef.current = () => {
      if (uploadTaskRef.current) {
        try { uploadTaskRef.current.cancelAsync(); } catch {}
        uploadTaskRef.current = null;
      }
      clearPollTimer();
      setPhase('idle');
      setUploadProgress(0);
      setStatusMsg('');
    };
    return () => { cancelUploadRef.current = null; };
  }, []);

  /**
   * Ref-mirror of isUploading. The blur handler reads this to avoid the
   * React batching delay between setState and the next render.
   */
  const isUploadingRef = useRef(false);
  isUploadingRef.current = isUploading;

  // ── Blur guard (fallback for NativeTabs layout on iOS 26+) ───────────────
  // GuardedTabButton in _layout.tsx handles ClassicTabLayout; this catches any
  // navigation path that bypasses that (e.g. native iOS tab switcher, hardware
  // back button leading to a parent stack pop, etc.).
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      // intentionalLeaveRef is set by GuardedTabButton when the user confirms
      // "Leave" in ClassicTabLayout — skip the dialog to avoid double-prompting.
      if (!isUploadingRef.current || intentionalLeaveRef.current) {
        intentionalLeaveRef.current = false;
        return;
      }

      // Navigate back to the upload tab so the user stays on it.
      const parentNav = navigation.getParent();
      parentNav?.navigate('upload' as never);

      Alert.alert(
        'Upload in progress',
        'Leaving will pause your upload. Resume next time you visit this screen.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              // Prevent the blur handler from re-triggering on the next navigation.
              intentionalLeaveRef.current = true;
              cancelUploadRef.current?.();
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation]);

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Copy to a stable file:// cache path immediately.
      // On iOS production builds, expo-image-picker can return ph:// or
      // ph-upload:// URIs that expo-file-system's native upload task cannot
      // read — copying ensures we always have a file:// URI for the upload.
      const ext = (asset.fileName?.split('.').pop() ?? 'mp4').toLowerCase();
      let stableUri = asset.uri;

      // Native builds benefit from a stable file:// cache copy. On web the
      // picker URI is a browser blob: URL and should be used directly.
      if (Platform.OS !== 'web') {
        const dest = `${LegacyFS.cacheDirectory ?? ''}upload_${Date.now()}.${ext}`;
        try {
          await LegacyFS.copyAsync({ from: asset.uri, to: dest });
          stableUri = dest;
        } catch {
          // If copy fails, fall back to the picker URI.
        }
      }

      setPickedUri(stableUri);
      setPickedName(asset.fileName ?? `video_${Date.now()}.mp4`);

      // On web use ImagePicker's fileSize. On native, stat the cached file.
      let fileSize = asset.fileSize ?? 0;
      if (Platform.OS !== 'web') {
        try {
          const info = await LegacyFS.getInfoAsync(stableUri);
          fileSize = info.exists ? (info as any).size ?? fileSize : fileSize;
        } catch {}
      }

      setPickedSize(fileSize);
      setPhase('idle');
      setUploadProgress(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function clearPollTimer() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollStatus(videoId: number, attempt = 0) {
    const MAX_ATTEMPTS = 40; // ~2 minutes at 3 s intervals
    if (attempt >= MAX_ATTEMPTS) {
      setPhase('error');
      setStatusMsg('Timed out waiting for video to process. Check back later.');
      return;
    }
    try {
      const res = await mobileApi.checkStatus(videoId);
      if (res.status === 'ready') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['explore'] });
        queryClient.invalidateQueries({ queryKey: ['my-videos'] });
        setPhase('done');
        setPickedUri(null);
        setPickedName('');
        setPickedSize(0);
        setTitle('');
        setDescription('');
        router.push({
          pathname: '/video/[id]' as any,
          params: { id: videoId },
        });
      } else if (res.status === 'error') {
        const MAX_ERROR_LEN = 120;
        const rawError = res.errorMessage?.trim();
        const errorDetail = rawError
          ? rawError.length > MAX_ERROR_LEN
            ? rawError.slice(0, MAX_ERROR_LEN) + '…'
            : rawError
          : null;
        setPhase('error');
        setStatusMsg(
          errorDetail
            ? `Processing failed: ${errorDetail}`
            : 'Video processing failed. Please try again.',
        );
      } else {
        // still pending/inprogress — keep polling
        pollTimerRef.current = setTimeout(() => pollStatus(videoId, attempt + 1), 3000);
      }
    } catch {
      // transient network error — retry
      pollTimerRef.current = setTimeout(() => pollStatus(videoId, attempt + 1), 3000);
    }
  }

  /**
   * Tell the backend that the direct GCS upload has finished.
   * We use the same API base URL/auth handling as mobileApi by exposing this
   * through mobileApi.completeUpload in lib/api.ts.
   */

  /**
   * Upload using the Google Cloud Storage V4 signed URL returned by the backend.
   * This is a normal signed PUT upload, not a TUS HEAD/PATCH session.
   */
  async function runUpload(opts: {
    fileUri: string;
    fileSize: number;
    title: string;
    description: string;
  }) {
    const {
      fileUri,
      fileSize,
      title: uploadTitle,
      description: uploadDesc,
    } = opts;

    clearPollTimer();
    setPhase('uploading');
    setUploadProgress(0);
    setStatusMsg('');

    try {
      // Create the backend video record and obtain a fresh GCS signed URL.
      const slot = await mobileApi.requestUpload(
        uploadTitle.trim(),
        fileSize,
        uploadDesc.trim() || undefined,
      );

      const uploadUrl = slot.uploadUrl;
      const videoId = slot.id;

      if (!uploadUrl || !videoId) {
        throw new Error('The upload server did not return a valid upload URL.');
      }

      if (Platform.OS === 'web') {
        // expo-file-system UploadTask is native-only. On web, read the
        // ImagePicker URI as a Blob and PUT it directly to the signed GCS URL.
        setStatusMsg('Uploading video…');

        const fileResponse = await fetch(fileUri);
        if (!fileResponse.ok) {
          throw new Error('Could not read the selected video file.');
        }

        const blob = await fileResponse.blob();
        const contentType = blob.type || 'video/mp4';

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: blob,
        });

        if (!uploadResponse.ok) {
          const errorBody = await uploadResponse.text().catch(() => '');
          console.error(
            'GCS upload failed:',
            uploadResponse.status,
            errorBody,
          );
          throw new Error(`Upload failed (HTTP ${uploadResponse.status})`);
        }

        setUploadProgress(1);
      } else {
        // Native Android/iOS can use Expo FileSystem for upload progress.
        const task = LegacyFS.createUploadTask(
          uploadUrl,
          fileUri,
          {
            httpMethod: 'PUT',
            uploadType: LegacyFS.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              'Content-Type': 'video/mp4',
            },
          },
          (event) => {
            if (event.totalBytesExpectedToSend > 0) {
              const progress =
                event.totalBytesSent / event.totalBytesExpectedToSend;
              setUploadProgress(Math.max(0, Math.min(1, progress)));
            }
          },
        );

        uploadTaskRef.current = task;
        const result = await task.uploadAsync();
        uploadTaskRef.current = null;

        if (!result || result.status < 200 || result.status >= 300) {
          throw new Error(
            `Upload failed (HTTP ${result?.status ?? 'unknown'})`,
          );
        }

        setUploadProgress(1);
      }

      // The bytes are now in GCS. Tell the backend the upload is complete,
      // then poll until processing/moderation reaches a terminal state.
      setPhase('processing');
setStatusMsg('Finalising video…');

console.log('GCS upload complete. Completing video:', videoId);

await mobileApi.completeUpload(videoId);

console.log('Video completed successfully:', videoId);

queryClient.invalidateQueries({ queryKey: ['feed'] });
queryClient.invalidateQueries({ queryKey: ['explore'] });
queryClient.invalidateQueries({ queryKey: ['my-videos'] });

Haptics.notificationAsync(
  Haptics.NotificationFeedbackType.Success,
);

setPhase('done');
setStatusMsg('Video uploaded successfully!');

setPickedUri(null);
setPickedName('');
setPickedSize(0);
setTitle('');
setDescription('');
    } catch (err: any) {
      clearPollTimer();

      if (uploadTaskRef.current) {
        try {
          await uploadTaskRef.current.cancelAsync();
        } catch {}
        uploadTaskRef.current = null;
      }

      console.error('Video upload failed:', err);
      setPhase('error');

      const rawMessage = err?.message ?? String(err ?? '');

      if (
        rawMessage.includes('403') ||
        rawMessage.includes('SignatureDoesNotMatch')
      ) {
        setStatusMsg(
          'Google Cloud Storage rejected the signed upload URL (HTTP 403).',
        );
      } else if (
        rawMessage.toLowerCase().includes('network') ||
        rawMessage.toLowerCase().includes('failed to fetch')
      ) {
        setStatusMsg(
          'Could not reach Google Cloud Storage. Check the Network tab for the PUT request and its HTTP status.',
        );
      } else {
        setStatusMsg(
          rawMessage || 'Something went wrong. Please try again.',
        );
      }
    }
  }

  async function handleUpload() {
    if (!pickedUri) {
      Alert.alert('No video selected', 'Please pick a video first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title before uploading.');
      return;
    }

    let fileSize = pickedSize;
    if (!fileSize && Platform.OS !== 'web') {
      const info = await LegacyFS.getInfoAsync(pickedUri);
      fileSize = info.exists ? (info as any).size ?? 0 : 0;
    }
    if (!fileSize) {
      Alert.alert('Error', 'Could not determine file size. Please try again.');
      return;
    }

    await runUpload({ fileUri: pickedUri, fileSize, title, description });
  }


  function handleRetry() {
    setPhase('idle');
    setUploadProgress(0);
    setStatusMsg('');
  }

  async function handleDeleteErrorVideo(video: any) {
    Alert.alert(
      'Upload Failed',
      `"${video.title ?? 'Untitled'}" failed to process.\n\nDelete this video and re-upload it to try again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Re-upload',
          style: 'destructive',
          onPress: async () => {
            try {
              await videoApi.deleteVideo(video.id);
              queryClient.invalidateQueries({ queryKey: ['my-videos', user?.id] });
              queryClient.invalidateQueries({ queryKey: ['user-videos', user?.id] });
            } catch {
              Alert.alert('Error', 'Could not delete the video. Please try again.');
            }
          },
        },
      ],
    );
  }

  if (capsLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!hasCreatorCap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Upload</Text>
        </View>
        <View style={styles.centered}>
          <View style={[styles.lockIcon, { backgroundColor: colors.muted }]}>
            <Feather name="lock" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>Videographer Access Required</Text>
          <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
            You need the{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
              mobile.creator
            </Text>{' '}
            capability to upload videos.
          </Text>
          <Text style={[styles.lockHint, { color: colors.mutedForeground }]}>
            Apply in your profile or contact the team to get access.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Upload</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >


        {/* Processing videos from prior sessions */}
        {(serverProcessingVideos.length > 0 || serverErrorVideos.length > 0) && !isUploading && (
          <View style={[styles.processingSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {serverProcessingVideos.length > 0 && (
              <>
                <View style={styles.processingSectionHeader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.processingSectionTitle, { color: colors.foreground }]}>
                    Processing{serverProcessingVideos.length > 1 ? ` (${serverProcessingVideos.length})` : ''}
                  </Text>
                </View>
                <Text style={[styles.processingSectionHint, { color: colors.mutedForeground }]}>
                  {serverProcessingVideos.length === 1
                    ? 'This video is still being processed.'
                    : 'These videos are still being processed.'}
                  {' '}They will appear in the feed once ready.
                </Text>
                {serverProcessingVideos.map((video: any) => {
                  const statusLabel =
                    video.status === 'pendingupload'
                      ? 'Uploading'
                      : video.status === 'pending'
                      ? 'Queued'
                      : 'Encoding';
                  return (
                    <View
                      key={video.id}
                      style={[styles.processingItem, { borderTopColor: colors.border }]}
                    >
                      <View style={[styles.processingThumb, { backgroundColor: colors.muted }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                      <View style={styles.processingInfo}>
                        <Text style={[styles.processingTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {video.title ?? 'Untitled'}
                        </Text>
                        <View style={styles.processingStatusRow}>
                          <View style={[styles.processingDot, { backgroundColor: colors.primary }]} />
                          <Text style={[styles.processingStatusText, { color: colors.mutedForeground }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            {serverErrorVideos.length > 0 && (
              <>
                <View style={[styles.processingSectionHeader, serverProcessingVideos.length > 0 && { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }]}>
                  <Feather name="alert-circle" size={14} color="#ef4444" />
                  <Text style={[styles.processingSectionTitle, { color: colors.foreground }]}>
                    Failed{serverErrorVideos.length > 1 ? ` (${serverErrorVideos.length})` : ''}
                  </Text>
                </View>
                <Text style={[styles.processingSectionHint, { color: colors.mutedForeground }]}>
                  {serverErrorVideos.length === 1
                    ? 'This video failed to process.'
                    : 'These videos failed to process.'}{' '}
                  Tap to delete and re-upload.
                </Text>
                {serverErrorVideos.map((video: any) => (
                  <Pressable
                    key={video.id}
                    style={({ pressed }) => [
                      styles.processingItem,
                      { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => handleDeleteErrorVideo(video)}
                  >
                    <View style={[styles.processingThumb, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                      <Feather name="alert-circle" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.processingInfo}>
                      <Text style={[styles.processingTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {video.title ?? 'Untitled'}
                      </Text>
                      <View style={styles.processingStatusRow}>
                        <View style={[styles.processingDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.processingStatusText, { color: '#ef4444' }]}>
                          Processing failed
                        </Text>
                      </View>
                    </View>
                    <Feather name="trash-2" size={15} color="rgba(239,68,68,0.6)" />
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {/* Video picker */}
        <Pressable
          style={({ pressed }) => [
            styles.picker,
            {
              backgroundColor: colors.card,
              borderColor: pickedUri ? colors.primary : colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={isUploading ? undefined : pickVideo}
          disabled={isUploading}
        >
          {pickedUri ? (
            <View style={styles.pickedPreview}>
              <Image source={{ uri: pickedUri }} style={styles.previewImg} contentFit="cover" />
              <View style={[styles.pickedBadge, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={14} color="#fff" />
              </View>
              {!isUploading && (
                <Pressable
                  onPress={pickVideo}
                  style={[styles.changeBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                >
                  <Feather name="refresh-cw" size={13} color="#fff" />
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.pickerContent}>
              <View style={[styles.pickerIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="video" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.pickerLabel, { color: colors.foreground }]}>
                Tap to select a video
              </Text>
              <Text style={[styles.pickerHint, { color: colors.mutedForeground }]}>
                MP4, MOV · from your photo library
              </Text>
            </View>
          )}
        </Pressable>

        {pickedUri && !isUploading && phase !== 'done' && (
          <View style={styles.fields}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Title <Text style={{ color: colors.primary }}>*</Text>
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Give your video a title…"
                  placeholderTextColor={colors.mutedForeground}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              <View
                style={[
                  styles.inputWrap,
                  styles.textareaWrap,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <TextInput
                  style={[styles.input, styles.textarea, { color: colors.foreground }]}
                  placeholder="Describe what's in this video…"
                  placeholderTextColor={colors.mutedForeground}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        )}

        {/* Upload progress */}
        {phase === 'uploading' && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressLabel, { color: colors.foreground }]}>
                Uploading… {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${Math.round(uploadProgress * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressHint, { color: colors.mutedForeground }]}>
              Keep the app open until the upload finishes.
            </Text>
          </View>
        )}

        {/* Processing state */}
        {phase === 'processing' && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressLabel, { color: colors.foreground }]}>Processing video…</Text>
            </View>
            <Text style={[styles.progressHint, { color: colors.mutedForeground }]}>
              Your video has been uploaded and is being finalised by the server.
            </Text>
          </View>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: '#ef4444' }]}>
            <Feather name="alert-circle" size={16} color="#ef4444" />
            <Text style={[styles.errorText, { color: colors.foreground }]}>
              {statusMsg || 'Upload failed. Please try again.'}
            </Text>
            <Pressable
              onPress={handleRetry}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Upload button */}
        {pickedUri && phase === 'idle' && (
          <Pressable
            style={({ pressed }) => [
              styles.uploadBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={handleUpload}
          >
            <Feather name="upload-cloud" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload Video</Text>
          </Pressable>
        )}

        {phase === 'done' && (
          <View style={[styles.doneCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.doneText, { color: colors.foreground }]}>Video uploaded successfully!</Text>
          </View>
        )}

        <View style={[styles.note, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Videos are uploaded to Google Cloud Storage and then shared to the Glassnik mobile feed. Only
            accounts with the{' '}
            <Text style={{ fontFamily: 'Inter_600SemiBold' }}>mobile.creator</Text> capability can upload.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  scroll: { padding: 20, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  lockIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  lockTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  lockSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  lockHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18, marginTop: 4 },
  picker: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 200,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContent: { alignItems: 'center', gap: 12, padding: 32 },
  pickerIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pickerLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  pickerHint: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pickedPreview: { width: '100%', aspectRatio: 16 / 9 },
  previewImg: { width: '100%', height: '100%' },
  pickedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtn: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  fields: { gap: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6, marginLeft: 2 },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
  },
  textareaWrap: { height: 'auto', paddingVertical: 12 },
  input: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  textarea: { height: 72, textAlignVertical: 'top' },
  uploadBtn: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  progressCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  progressHint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  doneCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  // Processing section
  processingSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  processingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  processingSectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  processingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  processingThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  processingInfo: {
    flex: 1,
    gap: 3,
  },
  processingTitle: {
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
  },
  processingStatusText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});