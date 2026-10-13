import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { FeedVideoItem } from '@/components/FeedVideoItem';
import { TopNav } from '@/components/TopNav';
import { Sidebar } from '@/components/Sidebar';
import { CommentsSheet } from '@/components/CommentsSheet';
import { type SampleVideo } from '@/constants/sampleVideos';
import { mobileApi } from '@/lib/api';
import { getPlaylist } from '@/lib/playlist';
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

import { WhatIsGlassnikModal } from '@/components/WhatIsGlassnikModal';

export default function FeedScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const desktopTopNavHeight = 64;
  const showWebTopNav = Platform.OS === 'web';
  const feedHeight = showWebTopNav
    ? Math.max(1, height - desktopTopNavHeight)
    : height;
  // Desktop feed: wider immersive card while retaining a portrait-style layout.
  // The video itself uses objectFit="cover", so it fills this entire area.
  const desktopFeedWidth = isMobile
    ? width
    : Math.min(width * 0.58, feedHeight * 0.82);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('foryou');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsVideoId, setCommentsVideoId] = useState<string | null>(null);
  const { isMuted, toggleMute } = useMute();

  // ?video=<id> means the visitor clicked a thumbnail on a Category, Place,
  // Destination or search page. The viewer then starts at that video and
  // plays the list saved from that page.
  const params = useLocalSearchParams<{ video?: string }>();
  const videoParam = Array.isArray(params.video) ? params.video[0] : params.video;

  const router = useRouter();

  // Closing the viewer returns to the page the visitor came from, at the
  // same scroll position. With no history (a direct link), go to Explore.
  const closeViewer = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/explore' as any);
    }
  };

  // The viewer (opened from a thumbnail) plays each video once and moves on
  // to the next one by itself. The normal home feed keeps looping.
  const viewerMode = !!videoParam;
  const feedScrollRef = useRef<ScrollView>(null);

  const { data: apiVideos } = useQuery<VideoAsset[]>({
    queryKey: ['feed'],
    queryFn: () => mobileApi.getFeed(1, 200),
    retry: false,
  });

  // Production feed: real API videos only
  const feedVideos: SampleVideo[] = [...(apiVideos ?? [])]
    .filter((v) => !!v.publicUrl)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .map(apiVideoToSample);

  // The list the viewer plays. Normally every video, newest first. When a
  // thumbnail was clicked, it is that page's list, rotated so it starts at
  // the clicked video (video 5 of 12 plays 5 to 12, then 1 to 4).
  const allVideos: SampleVideo[] = (() => {
    if (!videoParam) return feedVideos;

    const byId = new Map(feedVideos.map((v) => [v.id, v]));
    let list = getPlaylist()
      .map((id) => byId.get(id))
      .filter((v): v is SampleVideo => !!v);

    // No saved list (for example after a reload), or the clicked video is
    // not in it: fall back to every video.
    if (!list.some((v) => v.id === videoParam)) {
      list = feedVideos;
    }

    const start = list.findIndex((v) => v.id === videoParam);
    return start > 0 ? [...list.slice(start), ...list.slice(0, start)] : list;
  })();

  // A different clicked video starts again from the top of the list.
  useEffect(() => {
    setCurrentIndex(0);
  }, [videoParam]);

  // When the playing video ends, scroll to the next one. The last video in
  // the list simply stops.
  const handleVideoEnded = (index: number) => {
    if (index !== currentIndex) return;
    if (index >= allVideos.length - 1) return;

    feedScrollRef.current?.scrollTo({
      y: (index + 1) * feedHeight,
      animated: true,
    });
    setCurrentIndex(index + 1);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: SampleVideo; index: number }) => (
      <FeedVideoItem
        video={item}
        isActive={index === currentIndex}
        isFirstVideo={index === 0}
        shouldPreload={Math.abs(index - currentIndex) <= 1}
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
      <WhatIsGlassnikModal />
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
          ref={feedScrollRef}
          key={videoParam ?? 'feed'}
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
                isFirstVideo={index === 0}
                shouldPreload={Math.abs(index - currentIndex) <= 1}
                itemWidth={desktopFeedWidth}
                itemHeight={feedHeight}
                playOnce={viewerMode}
                onEnded={viewerMode ? () => handleVideoEnded(index) : undefined}
                onCommentPress={(videoId) =>
                  setCommentsVideoId(videoId)
                }
              />
            </View>
          ))}
        </ScrollView>
      ) : Platform.OS === 'web' ? (
        <ScrollView
          ref={feedScrollRef}
          key={videoParam ?? 'feed'}
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
                shouldPreload={Math.abs(index - currentIndex) <= 1}
                itemHeight={feedHeight}
                playOnce={viewerMode}
                onEnded={viewerMode ? () => handleVideoEnded(index) : undefined}
                onCommentPress={(videoId) => setCommentsVideoId(videoId)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          ref={feedScrollRef}
          key={videoParam ?? 'feed'}
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
              }}
            >
              <FeedVideoItem
                video={item}
                isActive={index === currentIndex}
                isFirstVideo={index === 0}
                shouldPreload={Math.abs(index - currentIndex) <= 1}
                itemHeight={feedHeight}
                onCommentPress={(videoId) =>
                  setCommentsVideoId(videoId)
                }
              />
            </View>
          ))}
        </ScrollView>
      )}


      {!isMobile && (
        <View style={[styles.topBar, { paddingTop: topInset + (Platform.OS === 'web' ? 8 : 12), pointerEvents: 'box-none' }]}>
          <View style={styles.topRight}>
            <Pressable onPress={toggleMute} hitSlop={8}>
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {videoParam ? (
        <Pressable onPress={closeViewer} hitSlop={10} style={styles.closeButton}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      ) : null}

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
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 58,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
});