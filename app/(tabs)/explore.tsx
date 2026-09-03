import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { mobileApi } from '@/lib/api';
import { type SampleVideo } from '@/constants/sampleVideos';
import type { VideoAsset } from '@/types';
import { TopNav } from '@/components/TopNav';
import { Sidebar, SIDEBAR_WIDTH } from '@/components/Sidebar';
import { TrendingSection } from '@/components/TrendingSection';
import { NearbySection } from '@/components/NearbySection';
import { GlobalSection } from '@/components/GlobalSection';

const MOBILE_BREAKPOINT = 768;

const CATEGORIES = [
  'All',
  'City Walks',
  'Local Life',
  'Food & Markets',
  'Nature & Scenery',
  'Beaches & Coastlines',
  'Architecture, Buildings and Landmarks',
  'Attractions',
  'Hidden Gems',
  'Peaceful Places',
  'Cafes',
  'Shopping',
  'Tours and Cruises',
  'Museums & Galleries',
  'Parks & Gardens',
  'Trails & Hiking',
  'Adventure',
  'Rides & Transport',
  'Scenic Drives',
  'Sports',
  'Events & Festivals',
  'Music & Performance',
  'Sacred Places',
  'After Dark',
];

const DISCOVERY_TABS = ['Explore', 'Trending', 'Nearby', 'Global'] as const;
type DiscoveryTab = typeof DISCOVERY_TABS[number];

function apiVideoToSample(v: VideoAsset): SampleVideo {
  const colors = ['#FF6B9D', '#FF4500', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
  const name = v.owner?.displayName ?? 'Unknown';

  // The live mobile feed currently exposes location as locationName
  // (for example "Bangkok, Thailand") rather than separate city/country
  // fields, so normalise it here for Explore.
  const locationName = (v as any).locationName?.trim() ?? '';
  const locationParts = locationName
    .split(',')
    .map((part: string) => part.trim())
    .filter(Boolean);

  const mappedCity =
    v.city ??
    (locationParts.length > 1 ? locationParts.slice(0, -1).join(', ') : locationParts[0]) ??
    undefined;

  const mappedCountry =
    v.country ??
    (locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined);

  // The live feed exposes categories as an array.
  // Keep support for the older singular category field as a fallback.
  const mappedCategory =
    v.category ??
    (v as any).categories?.[0]?.name ??
    undefined;

  return {
    id: String(v.id),
    uri: v.publicUrl ?? '',
    thumbnailUrl: v.thumbnailUrl ?? undefined,
    creatorId: v.owner?.id,
    creator: {
      name,
      username:
        v.owner?.username ??
        name.toLowerCase().replace(/\s+/g, ''),
      initial: name.charAt(0).toUpperCase(),
      color: colors[v.id % colors.length] ?? '#7C3AED',
      avatarUrl: v.owner?.avatarUrl ?? undefined,
    },
    description: v.description ?? v.title ?? '',
    hashtags: ['glassnik', 'pov'],
    music: 'Original Sound',
    likes: v.likes ?? 0,
    comments: 0,
    shares: v.shares ?? 0,
    place: v.place ?? v.title ?? undefined,
    city: mappedCity,
    country: mappedCountry,
    category: mappedCategory,
    createdAt: v.createdAt,
  };
}

export default function ExploreScreen() {
  const categoryScrollRef = React.useRef<ScrollView>(null);
  const categoryScrollX = React.useRef(0);
  const destinationScrollRef = React.useRef<ScrollView>(null);
  const destinationScrollX = React.useRef(0);

  const scrollCategoriesRight = React.useCallback(() => {
    categoryScrollX.current += 420;

    categoryScrollRef.current?.scrollTo({
      x: categoryScrollX.current,
      animated: true,
    });
  }, []);

  const scrollDestinationsRight = React.useCallback(() => {
    destinationScrollX.current += 420;

    destinationScrollRef.current?.scrollTo({
      x: destinationScrollX.current,
      animated: true,
    });
  }, []);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < MOBILE_BREAKPOINT;
  const params = useLocalSearchParams<{
    discovery?: string;
    category?: string;
  }>();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDiscoveryTab, setActiveDiscoveryTab] = useState<DiscoveryTab>('Explore');

  useEffect(() => {
    const fromParam = params.discovery;
    if (fromParam && (DISCOVERY_TABS as readonly string[]).includes(fromParam)) {
      if (fromParam !== activeDiscoveryTab) {
        setActiveDiscoveryTab(fromParam as DiscoveryTab);
      }
    } else if (!fromParam && activeDiscoveryTab !== 'Explore') {
      setActiveDiscoveryTab('Explore');
    }
  }, [params.discovery]);

  useEffect(() => {
    const categoryParam = Array.isArray(params.category)
      ? params.category[0]
      : params.category;

    if (!categoryParam) return;

    const matchingCategory = CATEGORIES.find(
      (category) =>
        category.toLowerCase() === categoryParam.toLowerCase()
    );

    if (matchingCategory) {
      setActiveDiscoveryTab('Explore');
      setQuery('');
      setActiveCategory(matchingCategory);
    }
  }, [params.category]);

  const { data: apiVideos, isLoading } = useQuery<VideoAsset[]>({
    queryKey: ['explore'],
    queryFn: () => mobileApi.getFeed(1, 50),
    retry: false,
  });

  const allVideos = useMemo(() => {
    const api = (apiVideos ?? []).filter((v) => !!v.publicUrl).map(apiVideoToSample);
    const sortedApi = [...api].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return sortedApi;
  }, [apiVideos]);

  const trendingDestinations = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const v of allVideos) {
      if (!v.city && !v.country) continue;
      const label = [v.city, v.country].filter(Boolean).join(', ');
      const key = label;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { label, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [allVideos]);

  const filtered = useMemo(() => {
    let result = allVideos;

    if (activeCategory !== 'All') {
      result = result.filter((v) => v.category === activeCategory);
    }

    if (!query.trim()) return result;
    const q = query.toLowerCase();
    return result.filter(
      (v) =>
        v.description.toLowerCase().includes(q) ||
        v.creator.username.toLowerCase().includes(q) ||
        v.hashtags.some((h) => h.includes(q)) ||
        v.city?.toLowerCase().includes(q) ||
        v.country?.toLowerCase().includes(q)
    );
  }, [allVideos, query, activeCategory]);

  const contentWidth = isMobile ? width : width - SIDEBAR_WIDTH;

  // Instagram/TikTok-style portrait cards on both mobile and desktop —
  // reverted from an earlier landscape attempt. Desktop columns bumped
  // from 3 to 4 to compensate: portrait cards are much taller per row,
  // so narrower/more columns is what keeps the "first row visible without
  // scrolling at 1366×768" requirement intact alongside this shape.
  const COLS = isMobile ? 2 : 4;
  const CELL_GAP = 6;
  const GRID_PADDING = isMobile ? 14 : 20;
  const cellWidth = (contentWidth - GRID_PADDING * 2 - CELL_GAP * (COLS - 1)) / COLS;
  const cellHeight = cellWidth * (16 / 9);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  function handleDestinationPress(label: string) {
    setActiveDiscoveryTab('Explore');
    setQuery(label);
  }

  function handleViewAllDestinations() {
    setActiveDiscoveryTab('Trending');
  }

  let discoveryContent: React.ReactNode;

  if (activeDiscoveryTab === 'Trending') {
    discoveryContent = (
      <TrendingSection
        videos={allVideos}
        isMobile={isMobile}
        contentWidth={contentWidth}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        renderVideoCard={(v) => <VideoGridCell video={v} width={cellWidth} height={cellHeight} isMobile={isMobile} />}
        onDestinationPress={handleDestinationPress}
      />
    );
  } else if (activeDiscoveryTab === 'Nearby') {
    discoveryContent = (
      <NearbySection
        videos={allVideos}
        isMobile={isMobile}
        contentWidth={contentWidth}
        onDestinationPress={handleDestinationPress}
      />
    );
  } else if (activeDiscoveryTab === 'Global') {
    discoveryContent = (
      <GlobalSection
        videos={allVideos}
        isMobile={isMobile}
        contentWidth={contentWidth}
        onDestinationPress={handleDestinationPress}
      />
    );
  } else {
    discoveryContent = (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        scrollEnabled={false}
        ListHeaderComponent={
          !query ? (
            <View>
              {isMobile && trendingDestinations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Trending Destinations</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
                    {trendingDestinations.map((d) => (
                      <Pressable key={d.label} style={styles.trendChip} onPress={() => setQuery(d.label)}>
                        <Feather name="map-pin" size={12} color="#FE2C55" />
                        <Text style={styles.trendChipTag}>{d.label}</Text>
                        <Text style={styles.trendChipCount}>
                          {d.count} {d.count === 1 ? 'experience' : 'experiences'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              <View
                style={[
                  styles.sectionHeaderRow,
                  !isMobile && styles.sectionHeaderRowDesktop,
                ]}
              >
                <Text style={styles.sectionTitle}>Trending Destinations</Text>
                <Text style={styles.sectionCount}>{filtered.length} experiences</Text>
              </View>
            </View>
          ) : null
        }
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={{ paddingHorizontal: GRID_PADDING }}
        renderItem={({ item, index }) => (
          <VideoGridCell
            video={item}
            width={cellWidth}
            height={cellHeight}
            isMobile={isMobile}
            isFirst={index === 0}
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
              <Text style={styles.emptyText}>No results{query ? ` for "${query}"` : ''}</Text>
            </View>
          )
        }
      />
    );
  }

  return (
    <View style={styles.screenRoot}>
      <View style={{ paddingTop: topPad }}>
        <TopNav />
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {!isMobile && <Sidebar />}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {isMobile ? (
            <View style={styles.bannerMobile}>
              <Image
                source={require('@/assets/images/home-banner.png')}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="right"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.heroMobile}>
                <Text style={styles.heroTitleMobile}>
                  Don't scroll through the world.{'\n'}
                  <Text style={styles.heroTitleAccent}>Experience</Text> it.
                </Text>
                <Text style={styles.heroSubtitleMobile}>
                  Glassnik turns real-world smart-glasses Eye-POV videos into immersive experiences.
                </Text>
              </View>

              <View style={styles.searchWrapMobile}>
                <Feather name="search" size={14} color="rgba(255,255,255,0.5)" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search places, attractions or Eye-POV experiences…"
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
                    <Feather name="x" size={13} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.banner}>
              <Image
                source={require('@/assets/images/home-banner.png')}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="top right"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.bannerRow}>
                <View style={styles.hero}>
                  <Text style={styles.heroTitle}>
                    Don't scroll through the world. <Text style={styles.heroTitleAccent}>Experience</Text> it.
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Glassnik turns real-world smart-glasses Eye-POV videos into immersive experiences.
                  </Text>
                </View>

                <View style={styles.searchWrap}>
                  <Feather name="search" size={14} color="rgba(255,255,255,0.5)" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search places, attractions or Eye-POV experiences…"
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
                      <Feather name="x" size={13} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={[styles.header, !isMobile && styles.headerDesktop]}>
            {isMobile && (
              <DiscoveryTabs active={activeDiscoveryTab} onChange={setActiveDiscoveryTab} />
            )}

            {isMobile ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    >
                      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.labeledRow}>
                  <Text style={styles.rowLabel}>Categories:</Text>
                  <ScrollView
                    ref={categoryScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryRow}
                    style={{ flex: 1 }}
                    onScroll={(event) => {
                      categoryScrollX.current = event.nativeEvent.contentOffset.x;
                    }}
                    scrollEventThrottle={16}
                  >
                    {CATEGORIES.map((cat) => {
                      const isActive = activeCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setActiveCategory(cat)}
                          style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                        >
                          <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                            {cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable
                    onPress={scrollCategoriesRight}
                    hitSlop={8}
                    style={styles.horizontalNavButton}
                  >
                    <Feather name="chevron-right" size={20} color="#111" />
                  </Pressable>
                </View>

                {trendingDestinations.length > 0 && (
                  <View style={styles.labeledRow}>
                    <Text style={styles.rowLabel}>Trending Destinations:</Text>
                    <ScrollView
                      ref={destinationScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryRow}
                      style={{ flex: 1 }}
                      onScroll={(event) => {
                        destinationScrollX.current = event.nativeEvent.contentOffset.x;
                      }}
                      scrollEventThrottle={16}
                    >
                      {trendingDestinations.map((d) => (
                        <Pressable key={d.label} style={styles.trendChipCompact} onPress={() => setQuery(d.label)}>
                          <Feather name="map-pin" size={11} color="#FE2C55" />
                          <Text style={styles.trendChipCompactTag}>{d.label}</Text>
                          <Text style={styles.trendChipCompactCount}>{d.count}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Pressable
                      onPress={scrollDestinationsRight}
                      hitSlop={8}
                      style={styles.horizontalNavButton}
                    >
                      <Feather name="chevron-right" size={20} color="#111" />
                    </Pressable>

                    <Pressable onPress={handleViewAllDestinations} hitSlop={8}>
                      <Text style={styles.viewAllText}>View all</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>

          {discoveryContent}

          <View style={styles.footer}>
            <View style={styles.footerColumnsRow}>
              {FOOTER_COLUMNS.map((col) => (
                <View key={col.heading} style={styles.footerColumn}>
                  <Text style={styles.footerHeading}>{col.heading}</Text>
                  {col.links.map((link) => (
                    <Pressable key={link.label} onPress={() => Linking.openURL(link.url)}>
                      <Text style={styles.footerLinkText}>{link.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            <Text style={styles.footerDisclaimer}>
              As an Amazon Associate, Glassnik earns from qualifying purchases.
            </Text>

            <View style={styles.footerSocialRow}>
              {SOCIAL_LINKS.map((s) => (
                <Pressable key={s.icon} onPress={() => Linking.openURL(s.url)} hitSlop={8}>
                  <Feather name={s.icon} size={16} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ))}
            </View>

            <Text style={styles.footerCopyright}>© 2026 Glassnik</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const FOOTER_COLUMNS: { heading: string; links: { label: string; url: string }[] }[] = [
  {
    heading: 'COMPANY',
    links: [
      { label: 'About Us', url: 'https://www.glassnik.com/about-us' },
      { label: 'Contact', url: 'https://www.glassnik.com' },
      { label: 'Corporate Information', url: 'https://www.glassnik.com/corporate-information' },
      { label: 'Investor Relations', url: 'https://www.glassnik.com/investor-relations' },
    ],
  },
  {
    heading: 'EXPLORE',
    links: [
      { label: 'Why Glassnik', url: 'https://www.glassnik.com/whyglassnik' },
      { label: 'For Videographers', url: 'https://www.glassnik.com/for-videographers' },
      { label: 'Premium', url: 'https://www.glassnik.com/glassnik-premium' },
      { label: 'Live', url: 'https://www.glassnik.com/live' },
      { label: 'Immersive', url: 'https://www.glassnik.com/immersive' },
      { label: 'Store', url: 'https://www.glassnik.com/smart-glasses-store' },
    ],
  },
  {
    heading: 'RESOURCES',
    links: [
      { label: 'Help Center', url: 'https://www.glassnik.com/reviews' },
      { label: 'Account', url: 'https://www.glassnik.com' },
      { label: 'News', url: 'https://www.glassnik.com' },
    ],
  },
  {
    heading: 'LEGAL',
    links: [
      { label: 'Terms of Service', url: 'https://www.glassnik.com/terms-of-service' },
      { label: 'Privacy Policy', url: 'https://www.glassnik.com/privacy-policy' },
      { label: 'Videographer Policy', url: 'https://www.glassnik.com/privacy-policy-1' },
      { label: 'Complaints Policy', url: 'https://www.glassnik.com/complaints-policy' },
    ],
  },
];

const SOCIAL_LINKS = [
  { icon: 'facebook' as const, url: 'https://www.facebook.com/glassnikofficial' },
  { icon: 'instagram' as const, url: 'https://www.instagram.com/glassnik_official' },
  { icon: 'twitter' as const, url: 'https://x.com/glassnik' },
];

function DiscoveryTabs({
  active,
  onChange,
}: {
  active: DiscoveryTab;
  onChange: (tab: DiscoveryTab) => void;
}) {
  const icons: Record<DiscoveryTab, React.ComponentProps<typeof Feather>['name']> = {
    Explore: 'compass',
    Trending: 'trending-up',
    Nearby: 'map-pin',
    Global: 'globe',
  };
  return (
    <View style={styles.discoveryRow}>
      {DISCOVERY_TABS.map((tab) => {
        const isActive = active === tab;
        return (
          <Pressable key={tab} style={styles.discoveryTab} onPress={() => onChange(tab)}>
            <Feather name={icons[tab]} size={14} color={isActive ? '#fff' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.discoveryTabText, isActive && styles.discoveryTabTextActive]}>
              {tab}
            </Text>
            {isActive && <View style={styles.discoveryTabUnderline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function WebVideoThumb({
  uri,
  isFirst,
  hovered,
}: {
  uri: string;
  isFirst: boolean;
  hovered: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [clickedPlaying, setClickedPlaying] = React.useState(false);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.defaultMuted = true;

    const shouldPlay = isFirst || hovered || clickedPlaying;

    if (shouldPlay) {
      const startPlayback = () => {
        el.muted = true;
        el.defaultMuted = true;

        const playPromise = el.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      if (el.readyState >= 2) {
        startPlayback();
      } else {
        el.addEventListener('canplay', startPlayback, { once: true });
      }

      return () => {
        el.removeEventListener('canplay', startPlayback);
      };
    }

    el.pause();

    try {
      el.currentTime = 0.1;
    } catch {}
  }, [uri, isFirst, hovered, clickedPlaying]);

  const handleClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const el = videoRef.current;
    if (!el) return;

    if (!el.paused) {
      el.pause();
      setClickedPlaying(false);
    } else {
      setClickedPlaying(true);

      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }
  };

  return React.createElement('video', {
    ref: videoRef,
    src: uri,
    playsInline: true,
    muted: true,
    autoPlay: isFirst,
    preload: isFirst ? 'auto' : 'metadata',
    loop: true,
    onClick: handleClick,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center',
      cursor: 'pointer',
    },
  });
}


function MobileVideoThumb({
  uri,
  playing,
}: {
  uri: string;
  playing: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    try {
      player.muted = true;

      if (playing) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function VideoGridCell({
  video,
  width,
  height,
  isMobile = false,
  isFirst = false,
}: {
  video: SampleVideo;
  width: number;
  height: number;
  isMobile?: boolean;
  isFirst?: boolean;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isMobilePlaying, setIsMobilePlaying] = React.useState(false);

  const locationText = [video.place, video.city, video.country].filter(Boolean).join(', ');
  const placeTourTransport = video.description || null;
  const metaLine = [placeTourTransport, locationText].filter(Boolean).join(' • ');

  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  const shouldUseWebVideo =
    Platform.OS === 'web' &&
    !isMobile &&
    !!video.uri;

  const thumbnailNode = shouldUseWebVideo ? (
    <WebVideoThumb
      uri={video.uri}
      isFirst={isFirst}
      hovered={isHovered}
    />
  ) : isMobile && Platform.OS !== 'web' && !!video.uri && isMobilePlaying ? (
    <MobileVideoThumb
      uri={video.uri}
      playing={isMobilePlaying}
    />
  ) : video.thumbnailUrl ? (
    <Image
      source={{ uri: video.thumbnailUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      contentPosition="center"
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
  );

  return (
    <View style={{ width, marginBottom: 14 }}>
      <Pressable
        onPress={() => {
          if (isMobile && Platform.OS !== 'web' && video.uri) {
            setIsMobilePlaying((current) => !current);
          }
        }}
        onHoverIn={() => {
          if (Platform.OS === 'web' && !isMobile) {
            setIsHovered(true);
          }
        }}
        onHoverOut={() => {
          if (Platform.OS === 'web' && !isMobile) {
            setIsHovered(false);
          }
        }}
        style={({ pressed }) => [
          styles.cell,
          { width, height, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        {thumbnailNode}
        <View style={styles.cellScrim} />

        {isMobile ? (
          <>
            <View style={styles.cellTopRow}>
              <Text style={styles.cellUsername} numberOfLines={1}>@{video.creator.username}</Text>
            </View>
            <View style={styles.cellBottomBox}>
              {metaLine ? (
                <View style={styles.cellMetaRow}>
                  <Text style={styles.cellMetaText} numberOfLines={1}>
                    {metaLine}
                  </Text>
                  {video.category ? (
                    <View style={styles.cellCategoryPill}>
                      <Text style={styles.cellCategoryText} numberOfLines={1}>
                        {video.category.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.cellTopRowDesktop}>
              <Text style={styles.cellUsername} numberOfLines={1}>@{video.creator.username}</Text>
              <View style={styles.cellMiniTabs}>
                <Text style={styles.cellMiniTabActive}>For You</Text>
                <Text style={styles.cellMiniTab}>Following</Text>
              </View>
            </View>
            {video.category ? (
              <View style={styles.cellTagDesktop}>
                <Text style={styles.cellTagTextDesktop} numberOfLines={1}>
                  {video.category.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {locationText ? (
              <View style={styles.cellLocationDesktop}>
                <Feather name="map-pin" size={8} color="rgba(255,255,255,0.85)" />
                <Text style={styles.cellLocationTextDesktop} numberOfLines={1}>
                  {locationText}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </Pressable>

      <View style={styles.cellActions}>
        <View style={styles.cellActionItem}>
          <Feather name="heart" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.cellActionLabel}>{formatCount(video.likes)}</Text>
        </View>
        <View style={styles.cellActionItem}>
          <Feather name="message-circle" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.cellActionLabel}>{formatCount(video.comments)}</Text>
        </View>
        <View style={styles.cellActionItem}>
          <Feather name="send" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={styles.cellActionLabel}>{formatCount(video.shares)}</Text>
        </View>
        <View style={styles.cellActionItem}>
          <Feather name="flag" size={11} color="rgba(255,255,255,0.7)" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  horizontalNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 8,
    flexShrink: 0,
  },

  screenRoot: { flex: 1, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#000' },

  banner: {
    height: 104,
    paddingHorizontal: 20,
    backgroundColor: '#0a0f14',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  hero: { gap: 5, flexShrink: 1, maxWidth: '64%' },
  heroTitle: { color: '#fff', fontSize: 30, fontFamily: 'Inter_700Bold', lineHeight: 35 },
  heroTitleAccent: { color: '#5eead4' },
  heroSubtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '30%',
    minWidth: 180,
  },

  bannerMobile: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#0a0f14',
    overflow: 'hidden',
    gap: 12,
  },
  heroMobile: { gap: 6 },
  heroTitleMobile: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', lineHeight: 24 },
  heroSubtitleMobile: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  searchWrapMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular', height: '100%' },

  header: {
    backgroundColor: '#000',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    gap: 12,
  },
  headerDesktop: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    gap: 8,
  },

  discoveryRow: { flexDirection: 'row', gap: 20 },
  discoveryTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, position: 'relative' },
  discoveryTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontFamily: 'Inter_500Medium' },
  discoveryTabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  discoveryTabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#fff', borderRadius: 1,
  },

  featureBoxesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  featureBox: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  featureBoxIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBoxContent: {
    flex: 1,
    gap: 4,
  },
  featureBoxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureBoxTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  featureBoxSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  liveBadge: {
    backgroundColor: 'rgba(254,44,85,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.4)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: '#FE2C55',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  labeledRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 0 },
  viewAllText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_600SemiBold', flexShrink: 0, marginLeft: 8 },

  categoryRow: { gap: 8, paddingRight: 14 },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  categoryPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  categoryPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: 'Inter_500Medium' },
  categoryPillTextActive: { color: '#000', fontFamily: 'Inter_600SemiBold' },

  section: { paddingTop: 18, paddingBottom: 10 },
  sectionTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 12, marginTop: 36, paddingHorizontal: 14,
  },
  sectionHeaderRowDesktop: {
    marginTop: 14,
    paddingHorizontal: 0,
  },
  sectionCount: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  tagsRow: { paddingHorizontal: 14, gap: 8 },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  trendChipHash: { color: '#FE2C55', fontSize: 13, fontFamily: 'Inter_700Bold' },
  trendChipTag: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  trendChipCount: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 4 },

  trendChipCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  trendChipCompactTag: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  trendChipCompactCount: { color: '#FE2C55', fontSize: 11, fontFamily: 'Inter_700Bold' },

  columnWrapper: { gap: 6 },

  cell: { overflow: 'hidden', borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  cellThumb: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellInitial: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  cellScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },

  cellTopRow: { position: 'absolute', top: 6, left: 6, right: 6 },
  cellUsername: {
    color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  cellBottomBox: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 6, paddingVertical: 5,
  },
  cellMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cellMetaText: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 7, fontFamily: 'Inter_500Medium' },
  cellCategoryPill: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', flexShrink: 0, maxWidth: '45%',
  },
  cellCategoryText: { color: 'rgba(255,255,255,0.9)', fontSize: 6, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },

  cellTopRowDesktop: {
    position: 'absolute', top: 6, left: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  cellMiniTabs: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  cellMiniTabActive: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold', textDecorationLine: 'underline' },
  cellMiniTab: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontFamily: 'Inter_500Medium' },
  cellTagDesktop: { position: 'absolute', bottom: 20, left: 6 },
  cellTagTextDesktop: {
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 7, fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, overflow: 'hidden',
  },
  cellLocationDesktop: {
    position: 'absolute', bottom: 5, left: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  cellLocationTextDesktop: { color: 'rgba(255,255,255,0.85)', fontSize: 7, fontFamily: 'Inter_500Medium', flexShrink: 1 },

  cellActions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 },
  cellActionItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cellActionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: 'Inter_500Medium' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, minHeight: 200 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  footer: {
    backgroundColor: '#000',
    padding: 20,
    paddingTop: 24,
    gap: 20,
  },
  footerColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerColumn: { gap: 8, flexShrink: 1 },
  footerHeading: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  footerLinkText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 3 },
  footerDisclaimer: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 14 },
  footerSocialRow: { flexDirection: 'row', gap: 16 },
  footerCopyright: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'Inter_400Regular' },
});