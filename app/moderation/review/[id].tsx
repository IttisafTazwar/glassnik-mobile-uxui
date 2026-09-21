import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

import { useAuth } from '@/context/AuthContext';
import { useMute } from '@/context/MuteContext';
import { moderationApi, videoApi } from '@/lib/api';
import {
  ModerationActionModal,
  type ModerationAction,
} from '@/components/ModerationActionModal';

export default function ModerationReviewScreen() {
  const { id, queueItemId, status } = useLocalSearchParams<{
    id?: string;
    queueItemId?: string;
    status?: string;
  }>();

  const { user } = useAuth();
  const { isMuted } = useMute();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canModerate =
    user?.role === 'MODERATOR' || user?.role === 'ADMIN';

  const videoId = Number(id);

  const {
    data: video,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => videoApi.getVideo(videoId),
    enabled: canModerate && Number.isFinite(videoId),
  });

  const videoUri = video?.publicUrl ?? null;

  const player = useVideoPlayer(
    videoUri,
    useCallback(
      (p: VideoPlayer) => {
        p.loop = false;
        p.muted = isMuted;
        if (videoUri) p.play();
      },
      [videoUri, isMuted],
    ),
  );

  React.useEffect(() => {
    try {
      player.muted = isMuted;
    } catch {}
  }, [isMuted, player]);

  const { status: playerStatus } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const isBuffering = playerStatus === 'loading';

  async function handleSubmitAction(
    action: ModerationAction,
    reason?: string,
  ) {
    if (!Number.isFinite(videoId)) return;

    setSubmitting(true);

    try {
      await moderationApi.submitAction({
        videoId,
        action,
        reason,
        queueItemId:
          queueItemId && Number.isFinite(Number(queueItemId))
            ? Number(queueItemId)
            : undefined,
      });

      setModalVisible(false);

      await queryClient.invalidateQueries({
        queryKey: ['moderation-queue'],
      });

      router.back();
    } catch (err) {
      console.error('Failed to submit moderation action:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!canModerate) {
    return (
      <View style={styles.centered}>
        <Feather name="shield" size={40} color="#fff" />
        <Text style={styles.accessTitle}>Moderator access required</Text>

        <Pressable onPress={() => router.back()} style={styles.simpleBack}>
          <Text style={styles.mutedText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!video || isError) {
    return (
      <View style={styles.centered}>
        <Feather
          name="alert-circle"
          size={36}
          color="rgba(255,255,255,0.55)"
        />
        <Text style={styles.accessTitle}>Experience not found</Text>

        <Pressable onPress={() => router.back()} style={styles.simpleBack}>
          <Text style={styles.mutedText}>Back to queue</Text>
        </Pressable>
      </View>
    );
  }

  const uploader =
    video.owner?.displayName ??
    video.owner?.username ??
    (video.ownerId != null ? `User #${video.ownerId}` : 'Unknown uploader');

  const username =
    video.owner?.username ??
    video.owner?.displayName?.toLowerCase().replace(/\s+/g, '') ??
    null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
          <Text style={styles.backText}>Back to queue</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Review Experience</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewLayout}>
          <View style={styles.videoColumn}>
            <View style={styles.videoFrame}>
              {videoUri ? (
                <VideoView
                  player={player}
                  style={styles.video}
                  allowsFullscreen
                  allowsPictureInPicture={Platform.OS !== 'web'}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.noVideo}>
                  <Feather
                    name="film"
                    size={44}
                    color="rgba(255,255,255,0.3)"
                  />
                  <Text style={styles.mutedText}>
                    No Experience available
                  </Text>
                </View>
              )}

              {isBuffering && (
                <View style={styles.buffering}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </View>
          </View>

          <View style={styles.details}>
            <View>
              <Text style={styles.eyebrow}>EXPERIENCE</Text>
              <Text style={styles.title}>
                {video.title ?? 'Untitled'}
              </Text>

              <Text style={styles.uploader}>
                {username ? `@${username}` : uploader}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Uploader</Text>
              <Text style={styles.metaValue}>{uploader}</Text>
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Video ID</Text>
              <Text style={styles.metaValue}>#{videoId}</Text>
            </View>

            {!!status && (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Queue status</Text>

                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>
            )}

            {!!video.description && (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Description</Text>
                <Text style={styles.description}>
                  {video.description}
                </Text>
              </View>
            )}

            <View style={styles.actionArea}>
              <Pressable
                style={styles.moderateButton}
                onPress={() => setModalVisible(true)}
              >
                <Feather name="flag" size={17} color="#000" />
                <Text style={styles.moderateButtonText}>
                  Moderate Experience
                </Text>
              </Pressable>

              <Pressable
                style={styles.returnButton}
                onPress={() => router.back()}
              >
                <Text style={styles.returnButtonText}>
                  Return to queue
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <ModerationActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmitAction}
        submitting={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  centered: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  accessTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },

  simpleBack: {
    marginTop: 20,
    padding: 12,
  },

  mutedText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
  },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
  },

  backButton: {
    width: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  backText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 180,
  },

  page: {
    flexGrow: 1,
    padding: 24,
  },

  reviewLayout: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 32,
  },

  videoColumn: {
    flex: Platform.OS === 'web' ? 1.35 : undefined,
    width: '100%',
    alignItems: 'center',
  },

  videoFrame: {
    width: '100%',
    maxWidth: 680,
    height: Platform.OS === 'web' ? 680 : 520,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  video: {
    width: '100%',
    height: '100%',
  },

  noVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  buffering: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  details: {
    flex: Platform.OS === 'web' ? 0.8 : undefined,
    width: '100%',
    maxWidth: 380,
    paddingTop: 12,
    gap: 22,
  },

  eyebrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },

  uploader: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 15,
    marginTop: 8,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  metaBlock: {
    gap: 7,
  },

  metaLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  metaValue: {
    color: '#fff',
    fontSize: 15,
  },

  description: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
  },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
  },

  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  actionArea: {
    marginTop: 8,
    gap: 10,
  },

  moderateButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },

  moderateButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },

  returnButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  returnButtonText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
});
