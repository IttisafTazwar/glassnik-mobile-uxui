import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { mobileApi } from '@/lib/api';
import { SAMPLE_VIDEOS, type SampleVideo } from '@/constants/sampleVideos';
import type { VideoAsset } from '@/types';
import { TopNav } from '@/components/TopNav';
import { Sidebar, SIDEBAR_WIDTH } from '@/components/Sidebar';

const CATEGORIES = [
  'All',
  'City Walks',
  'Local Life',
  'Food & Markets',
  'Nature & Scenery',
  'Beaches & Coastlines',
  'Architecture & Landmarks',
  'Attractions',
  'Hidden Gems',
  'Peaceful Places',
  'Cafes',
  'Shopping',
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
  return {
    id: String(v.id),
    uri: v.publicUrl ?? '',
    thumbnailUrl: v.thumbnailUrl ?? undefined,
    creator: { name, username: name.toLowerCase().replace(/\s+/g, ''), initial: name.charAt(0).toUpperCase(), color: colors[v.id % colors.length] ?? '#7C3AED', avatarUrl: v.owner?.avatarUrl ?? undefined },
    description: v.description ?? v.title ?? '',
    hashtags: ['glassnik', 'pov'],
    music: 'Original Sound',
    likes: 0, comments: 0, shares: 0,
    place: v.place ?? undefined,
    city: v.city ?? undefined,
    country: v.country ?? undefined,
    category: v.category ?? undefined,
  };
}

export default function ExploreScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDiscoveryTab, setActiveDiscoveryTab] = useState<DiscoveryTab>('Explore');

  const { data: apiVideos, isLoading } = useQuery<VideoAsset[]>({
    queryKey: ['explore'],
    queryFn: () => mobileApi.getFeed(1, 50),
    retry: false,
  });

  const allVideos = useMemo(() => {
    const api = (apiVideos ?? []).filter((v) => !!v.publicUrl).map(apiVideoToSample);
    return [...SAMPLE_VIDEOS, ...api];
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

  const contentWidth = width - SIDEBAR_WIDTH;

  const COLS = 4;
  const CELL_GAP = 6;
  const GRID_PADDING = 14;
  const cellWidth = (contentWidth - GRID_PADDING * 2 - CELL_GAP * (COLS - 1)) / COLS;
  const cellHeight = cellWidth * (16 / 9);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const listContent = activeDiscoveryTab !== 'Explore' ? (
    <View style={styles.centered}>
      <Feather name="clock" size={36} color="rgba(255,255,255,0.2)" />
      <Text style={styles.emptyText}>{activeDiscoveryTab} is coming soon</Text>
    </View>
  ) : (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      numColumns={COLS}
      scrollEnabled={false}
      ListHeaderComponent={
        !query ? (
          <View>
            {trendingDestinations.length > 0 && (
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Discover New Experiences</Text>
              <Text style={styles.sectionCount}>{filtered.length} experiences</Text>
            </View>
          </View>
        ) : null
      }
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={{ paddingHorizontal: GRID_PADDING }}
      renderItem={({ item }) => (
        <VideoGridCell video={item} width={cellWidth} height={cellHeight} />
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

  return (
    <View style={styles.screenRoot}>
      <View style={{ paddingTop: topPad }}>
        <TopNav />
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Sidebar />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner — heading near top, search bar at the bottom of the banner */}
          <ImageBackground
            source={require('@/assets/images/explore-banner.png')}
            style={styles.banner}
            imageStyle={{ opacity: 0.75 }}
            resizeMode="contain"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.bannerContent}>
              <View style={styles.hero}>
                <Text style={styles.heroTitle}>
                  Don't scroll through the world.{'\n'}
                  <Text style={styles.heroTitleAccent}>Experience</Text> it.
                </Text>
                <Text style={styles.heroSubtitle}>
                  Glassnik turns real-world smart-glasses Eye-POV videos into immersive experiences.
                </Text>
              </View>
            </View>

            <View style={styles.bannerSearchRow}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={16} color="rgba(255,255,255,0.5)" />
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
                    <Feather name="x" size={15} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                )}
              </View>
            </View>
          </ImageBackground>

          {/* Discovery tabs + categories — sit in the black area below the banner */}
          <View style={styles.header}>
            <DiscoveryTabs active={activeDiscoveryTab} onChange={setActiveDiscoveryTab} />
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
          </View>

          {listContent}

          {/* Footer */}
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

function VideoGridCell({
  video,
  width,
  height,
}: {
  video: SampleVideo;
  width: number;
  height: number;
}) {
  const locationLabel = [video.place, video.city, video.country].filter(Boolean).join(', ');

  return (
    <View style={{ width, marginBottom: 14 }}>
      <Pressable
        style={({ pressed }) => [
          styles.cell,
          { width, height, opacity: pressed ? 0.9 : 1 },
        ]}
      >
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

        <View style={styles.cellScrim} />

        <View style={styles.cellTopRow}>
          <Text style={styles.cellUsername} numberOfLines={1}>@{video.creator.username}</Text>
          <View style={styles.cellMiniTabs}>
            <Text style={styles.cellMiniTabActive}>For You</Text>
            <Text style={styles.cellMiniTab}>Following</Text>
          </View>
        </View>

        <View style={styles.cellTag}>
          <Text style={styles.cellTagText} numberOfLines={1}>
            {video.category ? video.category.toUpperCase() : `#${video.hashtags[0]}`}
          </Text>
        </View>

        {locationLabel ? (
          <View style={styles.cellLocation}>
            <Feather name="map-pin" size={8} color="rgba(255,255,255,0.85)" />
            <Text style={styles.cellLocationText} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.cellActions}>
        <Feather name="heart" size={13} color="rgba(255,255,255,0.7)" />
        <Feather name="message-circle" size={13} color="rgba(255,255,255,0.7)" />
        <Feather name="send" size={12} color="rgba(255,255,255,0.7)" />
        <Feather name="flag" size={12} color="rgba(255,255,255,0.7)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#000' },

  banner: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
    backgroundColor: '#0a0f14',
    overflow: 'hidden',
  },
  bannerContent: { gap: 10, maxWidth: '60%' },
  bannerSearchRow: { marginTop: 24, alignItems: 'flex-end', paddingRight: '5%' },
  hero: { gap: 10 },
  heroTitle: { color: '#fff', fontSize: 44, fontFamily: 'Inter_700Bold', lineHeight: 50 },
  heroTitleAccent: { color: '#5eead4' },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  header: {
    backgroundColor: '#000',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    gap: 12,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '50%',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular', height: '100%' },

  discoveryRow: { flexDirection: 'row', gap: 20 },
  discoveryTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, position: 'relative' },
  discoveryTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  discoveryTabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  discoveryTabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#fff', borderRadius: 1,
  },

  categoryRow: { gap: 8, paddingRight: 14 },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  categoryPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  categoryPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  categoryPillTextActive: { color: '#000', fontFamily: 'Inter_600SemiBold' },

  section: { paddingTop: 18, paddingBottom: 10 },
  sectionTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 12, marginTop: 36, paddingHorizontal: 14,
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

  columnWrapper: { gap: 6 },
  cell: { overflow: 'hidden', borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  cellThumb: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellInitial: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  cellScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  cellTopRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cellUsername: {
    color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  cellMiniTabs: { flexDirection: 'row', gap: 6 },
  cellMiniTabActive: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold', textDecorationLine: 'underline' },
  cellMiniTab: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontFamily: 'Inter_500Medium' },
  cellTag: { position: 'absolute', bottom: 20, left: 6 },
  cellTagText: {
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 7, fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, overflow: 'hidden',
  },
  cellLocation: { position: 'absolute', bottom: 5, left: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 2 },
  cellLocationText: { color: 'rgba(255,255,255,0.85)', fontSize: 7, fontFamily: 'Inter_500Medium', flexShrink: 1 },

  cellActions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 },

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