import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { FeedVideoItem } from '@/components/FeedVideoItem';
import { CommentsSheet } from '@/components/CommentsSheet';
import { SAMPLE_VIDEOS, type SampleVideo } from '@/constants/sampleVideos';
import { mobileApi } from '@/lib/api';
import { useMute } from '@/context/MuteContext';
import { useAuth } from '@/context/AuthContext';
import type { VideoAsset } from '@/types';

type ActiveTab = 'foryou' | 'following';

function apiVideoToSample(v: VideoAsset): SampleVideo {
  const colors = ['#FF6B9D', '#FF4500', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
  const name = v.owner?.displayName ?? 'Unknown';
  const username = v.owner?.username ?? name.toLowerCase().replace(/\s+/g, '');
  return {
    id: String(v.id),
    uri: v.publicUrl ?? '',
    thumbnailUrl: v.thumbnailUrl ?? undefined,
    creatorId: v.owner?.id,
    creator: {
      name,
      username,
      initial: name.charAt(0).toUpperCase(),
      color: colors[v.id % colors.length] ?? '#7C3AED',
      avatarUrl: v.owner?.avatarUrl ?? undefined,
    },
    description: v.description ?? v.title ?? '',
    hashtags: [],
    music: '',
    likes: v.likes ?? 0,
    comments: 0,
    shares: 0,
    place: v.place ?? null,
    city: v.city ?? null,
    country: v.country ?? null,
    category: v.category ?? null,
  };
}

export default function FeedScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('foryou');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsVideoId, setCommentsVideoId] = useState<string | null>(null);
  const { isMuted, toggleMute } = useMute();

  const { data: apiVideos } = useQuery<VideoAsset[]>({
    queryKey: ['feed'],
    queryFn: () => mobileApi.getFeed(1, 20),
    retry: false,
  });

  // Merge: sample videos first, then any API videos with URLs
  // Merge: real API videos first, then sample/demo videos
const allVideos: SampleVideo[] = [
  ...(apiVideos ?? [])
    .filter((v) => !!v.publicUrl)
    .map(apiVideoToSample),
  ...SAMPLE_VIDEOS,
];

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((t) => t.isViewable);
      if (first?.index != null) setCurrentIndex(first.index);
    }
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const renderItem = useCallback(
    ({ item, index }: { item: SampleVideo; index: number }) => (
      <FeedVideoItem
        video={item}
        isActive={index === currentIndex}
        onCommentPress={(videoId) => setCommentsVideoId(videoId)}
      />
    ),
    [currentIndex]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: height, offset: height * index, index }),
    [height]
  );

  const topInset = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Video feed ── */}
      <FlatList
        data={allVideos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled={Platform.OS !== 'web'}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        removeClippedSubviews={false}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />

      {/* ── Top overlay: For You | Following + icons ── */}
      <View style={[styles.topBar, { paddingTop: topInset + (Platform.OS === 'web' ? 8 : 12), pointerEvents: 'box-none' }]}>
        <View style={[styles.topLeft, { pointerEvents: 'none' }]}>
          {allVideos[currentIndex]?.creator?.username &&
           allVideos[currentIndex]?.creatorId !== user?.id ? (
            <Text style={styles.creatorHandle}>
              @{allVideos[currentIndex].creator.username}
            </Text>
          ) : null}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabSwitcher}>
          <Pressable onPress={() => setActiveTab('foryou')}>
            <Text style={[styles.tabText, activeTab === 'foryou' && styles.tabTextActive]}>
              For You
            </Text>
            {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable onPress={() => setActiveTab('following')}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
              Following
            </Text>
            {activeTab === 'following' && <View style={styles.tabUnderline} />}
          </Pressable>
        </View>

        {/* Right icons */}
        <View style={styles.topRight}>
          <Pressable onPress={toggleMute} hitSlop={8}>
            <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* ── Comments Sheet ── */}
      <CommentsSheet
        videoId={commentsVideoId}
        onClose={() => setCommentsVideoId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  topLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  creatorHandle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tabTextActive: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  tabUnderline: {
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 3,
    alignSelf: 'center',
    width: '80%',
  },
  topRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
