import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { VideoAsset } from '@/types';

interface VideoCardProps {
  video: VideoAsset;
  onPress: () => void;
}

export function VideoCard({ video, onPress }: VideoCardProps) {
  const colors = useColors();

  const displayName = video.owner?.displayName ?? 'Unknown Creator';
  const timeAgo = formatTimeAgo(video.createdAt);

  // Prefer explicit thumbnailUrl; fall back to publicUrl; last resort is placeholder
  const thumbnailUri = video.thumbnailUrl ?? video.publicUrl ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbnail, { backgroundColor: colors.secondary }]}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholderIcon}>
            <Feather name="film" size={32} color={colors.mutedForeground} />
          </View>
        )}

        {/* Dark scrim so the play button pops on any thumbnail */}
        <View style={styles.scrim} />

        {/* Play button overlay */}
        <View style={styles.playOverlay}>
          <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
            <Feather name="play" size={18} color="#fff" />
          </View>
        </View>

        {/* Duration badge (if available) */}
        {video.duration ? (
          <View style={[styles.durationBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {video.title ?? 'Untitled'}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.creator, { color: colors.mutedForeground }]}>{displayName}</Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  info: {
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  creator: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
});
