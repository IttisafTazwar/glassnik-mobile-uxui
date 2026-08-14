import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { mobileApi } from '@/lib/api';
import { SAMPLE_VIDEOS, type SampleVideo } from '@/constants/sampleVideos';
import type { VideoAsset } from '@/types';

const TRENDING = [
  { tag: 'FYP', count: '8.2B' },
  { tag: 'viral', count: '4.1B' },
  { tag: 'trending', count: '2.9B' },
  { tag: 'explore', count: '1.6B' },
  { tag: 'travel', count: '938M' },
  { tag: 'adventure', count: '712M' },
  { tag: 'art', count: '524M' },
  { tag: 'film', count: '317M' },
  { tag: 'cars', count: '248M' },
  { tag: 'fun', count: '190M' },
];

function apiVideoToSample(v: VideoAsset): SampleVideo {
  const colors = ['#FF6B9D', '#FF4500', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
  const name = v.owner?.displayName ?? 'Unknown';
  return {
    id: String(v.id),
    uri: v.publicUrl ?? '',
    thumbnailUrl: v.thumbnailUrl ?? undefined,
    creator: { name, username: name.toLowerCase().replace(/\s+/g, ''), initial: name.charAt(0).toUpperCase(), color: colors[v.id % colors.length] ?? '#7C3AED', avatarUrl: v.owner?.avatarUrl ?? undefined },
    description: v.description ?? v.title ?? '',
    hashtags: ['glassnik', 'pov'],
    music: 'Original Sound',
    likes: 0, comments: 0, shares: 0,
  };
}

export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const { data: apiVideos, isLoading } = useQuery<VideoAsset[]>({
    queryKey: ['explore'],
    queryFn: () => mobileApi.getFeed(1, 50),
    retry: false,
  });

  const allVideos = useMemo(() => {
    const api = (apiVideos ?? []).filter((v) => !!v.publicUrl).map(apiVideoToSample);
    return [...SAMPLE_VIDEOS, ...api];
  }, [apiVideos]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allVideos;
    const q = query.toLowerCase();
    return allVideos.filter(
      (v) =>
        v.description.toLowerCase().includes(q) ||
        v.creator.username.toLowerCase().includes(q) ||
        v.hashtags.some((h) => h.includes(q))
    );
  }, [allVideos, query]);

  const COLS = 3;
  const CELL_GAP = 2;
  const cellWidth = (width - CELL_GAP * (COLS - 1)) / COLS;
  const cellHeight = cellWidth * 1.5; // 2:3 portrait ratio

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 8;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search experiences, videographers, tags…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            selectionColor="#FE2C55"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={15} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        ListHeaderComponent={
          !query ? (
            <View>
              {/* Trending hashtags */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trending</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
                  {TRENDING.map((t) => (
                    <Pressable
                      key={t.tag}
                      style={styles.trendChip}
                      onPress={() => setQuery(t.tag)}
                    >
                      <Text style={styles.trendChipHash}>#</Text>
                      <Text style={styles.trendChipTag}>{t.tag}</Text>
                      <Text style={styles.trendChipCount}>{t.count} views</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <Text style={[styles.sectionTitle, { paddingHorizontal: 14, marginBottom: 8 }]}>All Experiences</Text>
            </View>
          ) : null
        }
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        renderItem={({ item, index }) => (
          <VideoGridCell
            video={item}
            width={cellWidth}
            height={cellHeight}
            showPlayCount={index < 6}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#FE2C55" />
            </View>
          ) : (
            <View style={styles.centered}>
              <Feather name="search" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function VideoGridCell({
  video,
  width,
  height,
  showPlayCount,
}: {
  video: SampleVideo;
  width: number;
  height: number;
  showPlayCount?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.cell,
        { width, height, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* Thumbnail image or color placeholder */}
      {video.thumbnailUrl ? (
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: video.creator.color, opacity: 0.25 }]} />
          <View style={styles.cellThumb}>
            <Text style={[styles.cellInitial, { color: video.creator.color }]}>
              {video.creator.initial}
            </Text>
          </View>
        </>
      )}

      {/* Scrim */}
      <View style={styles.cellScrim} />

      {/* Like count overlay */}
      {showPlayCount && (
        <View style={styles.cellLikes}>
          <Feather name="heart" size={10} color="#fff" />
          <Text style={styles.cellLikeText}>
            {video.likes >= 1000000
              ? `${(video.likes / 1000000).toFixed(1)}M`
              : `${(video.likes / 1000).toFixed(0)}K`}
          </Text>
        </View>
      )}

      {/* Hashtag */}
      <View style={styles.cellTag}>
        <Text style={styles.cellTagText} numberOfLines={1}>
          #{video.hashtags[0]}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Header
  header: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    height: '100%',
  },

  // Sections
  section: { paddingTop: 18, paddingBottom: 10 },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  tagsRow: { paddingHorizontal: 14, gap: 8 },
  trendChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 90,
  },
  trendChipHash: { color: '#FE2C55', fontSize: 13, fontFamily: 'Inter_700Bold' },
  trendChipTag: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 1 },
  trendChipCount: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Grid
  columnWrapper: { gap: 2, marginBottom: 2 },
  cell: {
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellThumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInitial: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  cellScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cellLikes: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cellLikeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cellTag: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  cellTagText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },

  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, minHeight: 200 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});