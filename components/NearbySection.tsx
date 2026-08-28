import React, { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { SampleVideo } from '@/constants/sampleVideos';
import { DestinationCard } from './DestinationCard';

interface Props {
  videos: SampleVideo[];
  isMobile: boolean;
  contentWidth: number;
  onDestinationPress: (label: string) => void;
}

export function NearbySection({ videos, isMobile, contentWidth, onDestinationPress }: Props) {
  // NOTE: there is no real geolocation/proximity data wired up — this shows
  // all available destinations from existing video data, not ones actually
  // sorted by distance from the viewer. True "nearby" sorting needs device
  // location + backend distance calculation, which doesn't exist yet.
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
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [videos]);

  const COLS = isMobile ? 2 : 5;
  const GAP = 10;
  const PADDING = 14;
  const cardWidth = (contentWidth - PADDING * 2 - GAP * (COLS - 1)) / COLS;

  function handleUseMyLocation() {
    // Placeholder — real geolocation permission + distance-based sorting is
    // a backend/native-permissions task not yet built.
    Alert.alert('Coming soon', 'Location-based sorting isn\'t available yet.');
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Feather name="map-pin" size={18} color="#fff" />
        <Text style={styles.title}>Popular Nearby Destinations</Text>
      </View>
      <Text style={styles.subtitle}>
        Discover Eye-POV experiences near you.{'\n'}Use your current location or choose a nearby destination.
      </Text>

      <Pressable style={styles.locationBtn} onPress={handleUseMyLocation}>
        <Feather name="navigation" size={14} color="#5eead4" />
        <Text style={styles.locationBtnText}>Use my location</Text>
      </Pressable>

      {destinations.length > 0 ? (
        <View style={[styles.grid, { paddingHorizontal: PADDING, gap: GAP }]}>
          {destinations.map((d) => (
            <DestinationCard
              key={`${d.city}|${d.country}`}
              city={d.city || d.country || 'Unknown'}
              country={d.city ? d.country : ''}
              count={d.count}
              width={cardWidth}
              onPress={() => onDestinationPress([d.city, d.country].filter(Boolean).join(', '))}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No destinations available yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 6 },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingHorizontal: 14, marginBottom: 14 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.4)',
  },
  locationBtnText: { color: '#5eead4', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'Inter_400Regular', paddingHorizontal: 14 },
});