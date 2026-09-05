import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { DesktopAppShell } from '@/components/DesktopAppShell';
import { TopNav } from '@/components/TopNav';
import { notificationsApi } from '@/lib/api';
import type { Notification } from '@/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: (actor: string, videoTitle?: string | null) => string }> = {
  like:        { icon: 'heart',         color: '#FE2C55', label: (a, v) => `${a} liked your Experience${v ? ` "${v}"` : ''}` },
  comment:     { icon: 'message-circle',color: '#0EA5E9', label: (a, v) => `${a} commented on${v ? ` "${v}"` : ' your Experience'}` },
  follow:      { icon: 'user-plus',     color: '#22c55e', label: (a)    => `${a} started following you` },
  video_ready: { icon: 'play-circle',   color: '#7C3AED', label: (_a, v) => `Your Experience${v ? ` "${v}"` : ''} is live and ready to share!` },
};

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  const colors = ['#FF6B9D', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#FE2C55', '#6366F1'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: 'Inter_700Bold' }}>{initial}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [markingAll, setMarkingAll] = useState(false);

  const { data: rawData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    enabled: !!user,
    refetchInterval: 30_000,
    retry: 1,
  });

  // notificationsApi.getNotifications always normalizes to Notification[]
  const notifications: Notification[] = rawData ?? [];

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: () => setMarkingAll(true),
    onSuccess: () => {
      queryClient.setQueryData(['notifications'], (old: any) => {
        const items: Notification[] = Array.isArray(old) ? old : (old?.notifications ?? old?.data ?? []);
        return items.map((n) => ({ ...n, read: true }));
      });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onSettled: () => setMarkingAll(false),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onMutate: (id) => {
      queryClient.setQueryData(['notifications'], (old: any) => {
        const items: Notification[] = Array.isArray(old) ? old : (old?.notifications ?? old?.data ?? []);
        return items.map((n) => n.id === id ? { ...n, read: true } : n);
      });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = useCallback(({ item }: { item: Notification }) => {
    const actorName = item.actor?.displayName ?? item.actor?.username ?? 'Someone';
    const cfg = TYPE_CONFIG[item.type] ?? { icon: 'bell', color: 'rgba(255,255,255,0.5)', label: () => `New notification` };

    return (
      <Pressable
        onPress={() => {
          if (!item.read) markOneMutation.mutate(item.id);
          if ((item.type === 'like' || item.type === 'comment' || item.type === 'video_ready') && item.videoId != null) {
            router.push(`/video/${item.videoId}` as any);
          } else if (item.type === 'follow' && item.actor?.id != null) {
            router.push(`/user/${item.actor.id}` as any);
          }
        }}
        style={({ pressed }) => [
          styles.row,
          !item.read && styles.rowUnread,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {/* Actor avatar */}
        <View>
          <Avatar name={actorName} size={44} />
          {/* Type icon badge */}
          <View style={[styles.typeBadge, { backgroundColor: cfg.color }]}>
            <Feather name={cfg.icon as any} size={10} color="#fff" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.message} numberOfLines={2}>
            {cfg.label(actorName, item.videoTitle)}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>

        {/* Unread dot */}
        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  }, [markOneMutation]);

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 8;

  if (!user) {
    return (
      <DesktopAppShell>
        {Platform.OS === 'web' && isMobile && <TopNav />}
        <View style={[styles.root, styles.center]}>
          <Feather name="bell-off" size={36} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>Sign in to see notifications</Text>
        </View>
      </DesktopAppShell>
    );
  }

  return (
    <DesktopAppShell>
        {Platform.OS === 'web' && isMobile && <TopNav />}
      <View style={styles.root}>
        {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => !markingAll && markAllMutation.mutate()}
            style={({ pressed }) => [styles.markAllBtn, { opacity: pressed || markingAll ? 0.6 : 1 }]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="rgba(255,255,255,0.5)" />
        </View>
      ) : isError && !(Platform.OS === 'web' && isMobile) ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>Could not load notifications.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell" size={44} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>All caught up!</Text>
          <Text style={styles.emptySub}>Notifications for likes, comments, and new followers show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
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
    </DesktopAppShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  markAllText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: 'Inter_500Medium' },

  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowUnread: { backgroundColor: 'rgba(255,255,255,0.03)' },
  separator: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)' },

  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },

  content: { flex: 1, gap: 3 },
  message: { color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'Inter_400Regular' },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FE2C55',
  },
});