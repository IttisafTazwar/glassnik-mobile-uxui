import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { videoApi } from '@/lib/api';
import type { Comment } from '@/types';

interface Props {
  videoId: string | null;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  const colors = ['#FF6B9D', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: 'Inter_700Bold' }}>{initial}</Text>
    </View>
  );
}

export function CommentsSheet({ videoId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['comments', videoId],
    queryFn: () => videoApi.getComments(videoId!),
    enabled: !!videoId,
    retry: 1,
  });

  // Handle both array and paginated response shapes
  const comments: Comment[] = Array.isArray(rawData)
    ? rawData
    : (rawData?.comments ?? rawData?.data ?? []);

  const postMutation = useMutation({
    mutationFn: (t: string) => videoApi.postComment(videoId!, t),
    onSuccess: (newComment: any) => {
      queryClient.setQueryData(['comments', videoId], (old: any) => {
        const prev: Comment[] = Array.isArray(old) ? old : (old?.comments ?? old?.data ?? []);
        return [newComment, ...prev];
      });
      setText('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    onError: () => {
      // Silently ignore — input remains for retry
    },
  });

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || postMutation.isPending) return;
    if (!user) return;
    postMutation.mutate(trimmed);
  }

  // Reset state when videoId changes
  useEffect(() => {
    setText('');
  }, [videoId]);

  const visible = !!videoId;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.kvWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Handle + header */}
          <View style={styles.headerRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          {/* Comment list */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="rgba(255,255,255,0.5)" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="message-circle" size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => <CommentRow comment={item} />}
              style={styles.list}
              contentContainerStyle={{ paddingVertical: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            {user ? (
              <Avatar name={user.displayName ?? user.email ?? 'U'} size={34} />
            ) : (
              <View style={[styles.anonAvatar]} />
            )}
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={text}
              onChangeText={setText}
              editable={!!user}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              selectionColor="#FE2C55"
              multiline={false}
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || postMutation.isPending || !user}
              style={({ pressed }) => [
                styles.sendBtn,
                { opacity: (!text.trim() || !user) ? 0.35 : pressed ? 0.7 : 1 },
              ]}
            >
              {postMutation.isPending ? (
                <ActivityIndicator size="small" color="#FE2C55" />
              ) : (
                <Feather name="send" size={18} color="#FE2C55" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const name = comment.author?.displayName ?? comment.author?.username ?? 'User';
  const username = comment.author?.username ?? 'user';
  return (
    <View style={styles.commentRow}>
      <Avatar name={name} size={36} />
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentAuthor}>@{username}</Text>
          <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    maxHeight: '80%',
    minHeight: 300,
  },

  headerRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  loadingWrap: { height: 120, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: 'Inter_400Regular' },

  list: { maxHeight: 340 },

  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  commentBody: { flex: 1, gap: 3 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  commentTime: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  commentText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  anonAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
