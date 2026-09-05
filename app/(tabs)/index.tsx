import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
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
import { TopNav } from '@/components/TopNav';
import { Sidebar } from '@/components/Sidebar';
import { CommentsSheet } from '@/components/CommentsSheet';
import { type SampleVideo } from '@/constants/sampleVideos';
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
    city: v.city ?? v.locationName ?? null,
    country: v.country ?? null,
    category: v.category ?? v.categories?.[0]?.name ?? null,
    categoryId: v.categories?.[0]?.id ?? null,
  };
}

export default function FeedScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const desktopTopNavHeight = 64;
  const showWebTopNav = Platform.OS === 'web';
  const feedHeight = showWebTopNav
    ? Math.max(1, height - desktopTopNavHeight)
    : height;
  const desktopFeedWidth = Math.min(width, feedHeight * (9 / 16));
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('foryou');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsVideoId, setCommentsVideoId] = useState<string | null>(null);
  const { isMuted, toggleMute } = useMute();

  const { data: apiVideos } = useQuery<VideoAsset[]>({
    queryKey: ['feed'],
    queryFn: () => mobileApi.getFeed(1, 50),
    retry: false,
  });

  // Production feed: real API videos only
  const allVideos: SampleVideo[] = [...(apiVideos ?? [])]
    .filter((v) => !!v.publicUrl)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .map(apiVideoToSample);

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
        isFirstVideo={index === 0}
        itemWidth={isMobile ? undefined : desktopFeedWidth}
        itemHeight={feedHeight}
        onCommentPress={(videoId) => setCommentsVideoId(videoId)}
      />
    ),
    [currentIndex, isMobile, desktopFeedWidth, feedHeight]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: feedHeight, offset: feedHeight * index, index }),
    [feedHeight]
  );

  const topInset = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {(!isMobile || showWebTopNav) && <TopNav />}

      <View style={styles.pageRow}>
        {!isMobile && <Sidebar />}

        <View style={styles.feedArea}>
          <View
            style={[
              styles.feedViewport,
              !isMobile && {
                width: desktopFeedWidth,
                height: feedHeight,
              },
            ]}
          >
      {/* ── Video feed ── */}
      {Platform.OS === 'web' && !isMobile ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{
            height: feedHeight,
            width: desktopFeedWidth,
          }}
          contentContainerStyle={{
            width: desktopFeedWidth,
          }}
          snapToInterval={feedHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset?.y ?? 0;
            const nextIndex = Math.max(
              0,
              Math.min(
                allVideos.length - 1,
                Math.round(y / feedHeight)
              )
            );

            if (nextIndex !== currentIndex) {
              setCurrentIndex(nextIndex);
            }
          }}
          scrollEventThrottle={16}
        >
          {allVideos.map((item, index) => (
            <View
              key={item.id}
              style={{
                width: desktopFeedWidth,
                height: feedHeight,
                scrollSnapAlign: 'start',
              } as any}
            >
              <FeedVideoItem
                video={item}
                isActive={index === currentIndex}
                itemWidth={desktopFeedWidth}
                itemHeight={feedHeight}
                onCommentPress={(videoId) => setCommentsVideoId(videoId)}
              />
            </View>
          ))}
        </ScrollView>
      ) : Platform.OS === 'web' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{
            height: feedHeight,
            width: '100%',
          }}
          contentContainerStyle={{
            width: '100%',
          }}
          snapToInterval={feedHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset?.y ?? 0;

            const nextIndex = Math.max(
              0,
              Math.min(
                allVideos.length - 1,
                Math.round(y / feedHeight)
              )
            );

            setCurrentIndex((previousIndex) =>
              previousIndex === nextIndex ? previousIndex : nextIndex
            );
          }}
        >
          {allVideos.map((item, index) => (
            <View
              key={item.id}
              style={{
                width: '100%',
                height: feedHeight,
                scrollSnapAlign: 'start',
              } as any}
            >
              <FeedVideoItem
                video={item}
                isActive={index === currentIndex}
                isFirstVideo={index === 0}
                itemHeight={feedHeight}
                onCommentPress={(videoId) => setCommentsVideoId(videoId)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={allVideos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          snapToInterval={feedHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={2}
        />
      )}


      {!isMobile && (
        <View style={[styles.topBar, { paddingTop: topInset + (Platform.OS === 'web' ? 8 : 12), pointerEvents: 'box-none' }]}>
          {/* Desktop For You / Following navigation remains unchanged. */}
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

          <View style={styles.topRight}>
            <Pressable onPress={toggleMute} hitSlop={8}>
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Comments Sheet ── */}
      <CommentsSheet
        videoId={commentsVideoId}
        onClose={() => setCommentsVideoId(null)}
      />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  pageRow: {
    flex: 1,
    flexDirection: 'row',
  },
  feedArea: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    overflow: 'hidden',
  },
  feedViewport: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
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
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -75 }],
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
