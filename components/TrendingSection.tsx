import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SampleVideo } from '@/constants/sampleVideos';
import { DestinationCard } from './DestinationCard';

interface Props {
  videos: SampleVideo[];
  isMobile: boolean;
  contentWidth: number;
  cellWidth: number;
  cellHeight: number;
  renderVideoCard: (video: SampleVideo) => React.ReactNode;
  onDestinationPress: (label: string) => void;
}

export function TrendingSection({
  videos,
  isMobile,
  contentWidth,
  renderVideoCard,
  onDestinationPress,
}: Props) {
  // Top Picks Right Now — sorted by likes. NOTE: there is no real view-count
  // field on the video data yet, so likes is used as the best available
  // proxy for "trending" until Tenzin wires up real view-count analytics.
  const topPicks = useMemo(
    () => [...videos].sort((a, b) => b.likes - a.likes).slice(0, 8),
    [videos]
  );

  // Most Watched — same proxy-by-likes caveat as above, showing the next
  // tier down from Top Picks.
  const mostWatched = useMemo(
    () => [...videos].sort((a, b) => b.likes - a.likes).slice(8, 20),
    [videos]
  );

  // Trending Destinations — top 10 by number of videos at that destination.
  // Real ranking should be by view count per the spec; this uses video
  // count as the available proxy until that data exists.
  const destinations = useMemo(() => {
    const counts = new Map<string, { city: string; country: string; count: number }>();
    for (const v of videos) {
      if (!v.city && !v.country) continue;
      const city = v.city ?? '';
      const country = v.country ?? '';
      const key = `${city}|${country}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { city, country, count: 1 });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [videos]);

  const DEST_COLS = isMobile ? 2 : 5;
  const DEST_GAP = 10;
  const DEST_PADDING = 14;
  const destCardWidth = (contentWidth - DEST_PADDING * 2 - DEST_GAP * (DEST_COLS - 1)) / DEST_COLS;

  return (
    <View>
      {/* Top Picks Right Now */}
      {topPicks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Picks Right Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
            {topPicks.map((v) => (
              <View key={v.id}>{renderVideoCard(v)}</View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Trending Destinations */}
      {destinations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending Destinations</Text>
          <View style={[styles.destGrid, { paddingHorizontal: DEST_PADDING, gap: DEST_GAP }]}>
            {destinations.map((d) => (
              <DestinationCard
                key={`${d.city}|${d.country}`}
                city={d.city || d.country || 'Unknown'}
                country={d.city ? d.country : ''}
                count={d.count}
                width={destCardWidth}
                onPress={() => onDestinationPress([d.city, d.country].filter(Boolean).join(', '))}
              />
            ))}
          </View>
        </View>
      )}

      {/* Glassnik Community — PLACEHOLDER stats. Spec calls for real,
          dynamically-pulled figures; no backend endpoint exists for this
          yet, so these numbers are illustrative only, not real data. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Glassnik Community</Text>
        <View style={styles.communityRow}>
          <View style={styles.communityCard}>
            <Text style={styles.communityNum}>—</Text>
            <Text style={styles.communityLabel}>Videographers</Text>
          </View>
          <View style={styles.communityCard}>
            <Text style={styles.communityNum}>—</Text>
            <Text style={styles.communityLabel}>Experiences</Text>
          </View>
          <View style={styles.communityCard}>
            <Text style={styles.communityNum}>—</Text>
            <Text style={styles.communityLabel}>Countries</Text>
          </View>
          <View style={styles.communityCard}>
            <Text style={styles.communityNum}>—</Text>
            <Text style={styles.communityLabel}>Total Views</Text>
          </View>
        </View>
        <Text style={styles.placeholderNote}>
          Live community stats coming soon.
        </Text>
      </View>

      {/* Most Watched */}
      {mostWatched.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Watched</Text>
          <View style={[styles.videoGrid, { paddingHorizontal: DEST_PADDING }]}>
            {mostWatched.map((v) => (
              <View key={v.id}>{renderVideoCard(v)}</View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 24, paddingBottom: 4 },
  sectionTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', paddingHorizontal: 14, marginBottom: 12 },
  horizontalRow: { paddingHorizontal: 14, gap: 8 },
  destGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  communityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 },
  communityCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  communityNum: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  communityLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  placeholderNote: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'Inter_400Regular', paddingHorizontal: 14, marginTop: 8 },
});