import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { moderationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ModerationActionModal, type ModerationAction } from '@/components/ModerationActionModal';

// TODO: gate this screen once the `role` field is confirmed on the User
// type (e.g. redirect away if user.role isn't MODERATOR/ADMIN). Backend
// enforces this regardless — this is just a frontend UX nicety, not the
// real security boundary.

const STATUS_TABS = ['PENDING', 'ASSIGNED', 'DONE', 'SKIPPED'] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function ModerationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeStatus, setActiveStatus] = useState<StatusTab>('PENDING');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['moderation-queue', activeStatus],
    queryFn: () => moderationApi.getQueue({ status: activeStatus }),
  });

  // Response shape isn't confirmed yet — defensively handle either a bare
  // array or a paginated { data: [...] } wrapper, matching the pattern
  // already used elsewhere in this app (e.g. video lists).
  const queueItems: any[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 8;

  async function handleAssignToMe(item: any) {
    if (!user || assigningId != null) return;
    setAssigningId(item.id);
    try {
      await moderationApi.assignToQueue(item.id, user.id);
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
    } catch (err: any) {
      // Minimal inline error handling — no Alert import needed for this yet
      console.error('Failed to assign:', err);
    } finally {
      setAssigningId(null);
    }
  }

  function openActionModal(item: any) {
    setSelectedItem(item);
    setModalVisible(true);
  }

  async function handleSubmitAction(action: ModerationAction, reason?: string) {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await moderationApi.submitAction({
        videoId: selectedItem.videoId ?? selectedItem.video?.id ?? selectedItem.id,
        action,
        reason,
        queueItemId: selectedItem.id,
      });
      setModalVisible(false);
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
    } catch (err: any) {
      console.error('Failed to submit moderation action:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Moderation Queue</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsRow}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveStatus(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FE2C55" />
        </View>
      ) : queueItems.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="check-circle" size={36} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>Nothing in the {activeStatus.toLowerCase()} queue</Text>
        </View>
      ) : (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#fff" />
          }
          renderItem={({ item }) => {
            const video = item.video ?? item;
            const thumbnailUrl = video.thumbnailUrl ?? null;
            const title = video.title ?? video.description ?? 'Untitled';
            const uploader = video.owner?.displayName ?? video.owner?.username ?? 'Unknown uploader';
            const isAssignedToMe = item.assignedToId === user?.id;

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.thumbWrap}>
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Feather name="film" size={20} color="rgba(255,255,255,0.3)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.cardUploader} numberOfLines={1}>{uploader}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, isAssignedToMe && { backgroundColor: '#10B981' }]} />
                      <Text style={styles.statusText}>
                        {item.status}{isAssignedToMe ? ' · Assigned to you' : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  {!isAssignedToMe && (
                    <Pressable
                      style={styles.assignBtn}
                      onPress={() => handleAssignToMe(item)}
                      disabled={assigningId === item.id}
                    >
                      {assigningId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="user-plus" size={14} color="#fff" />
                          <Text style={styles.assignBtnText}>Assign to me</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  <Pressable style={styles.reviewBtn} onPress={() => openActionModal(item)}>
                    <Feather name="flag" size={14} color="#000" />
                    <Text style={styles.reviewBtnText}>Review</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

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

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tabTextActive: { color: '#000' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 12,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  thumbWrap: {
    width: 64,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardUploader: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  statusText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular' },

  cardActions: { flexDirection: 'row', gap: 8 },
  assignBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  assignBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  reviewBtnText: { color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});