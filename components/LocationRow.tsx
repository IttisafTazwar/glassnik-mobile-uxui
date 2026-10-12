import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Item = { key: string; label: string; count: number };
type Tab = 'Destinations' | 'Places';

type Props = {
  destinations: Item[];
  places: Item[];
  activeDestinationKey?: string | null;
  activePlaceKey?: string | null;
  onSelectDestination: (item: Item) => void;
  onSelectPlace: (item: Item) => void;
  onViewAllDestinations: () => void;
  onViewAllPlaces: () => void;
};

// One discovery row with a Destinations | Places toggle (Steve's mockup).
// The selected pill is highlighted, and the row follows the address: opening a
// Place link shows the Places tab, opening a Destination link shows the
// Destinations tab, and the highlighted pill is scrolled into view.
export function LocationRow({
  destinations,
  places,
  activeDestinationKey,
  activePlaceKey,
  onSelectDestination,
  onSelectPlace,
  onViewAllDestinations,
  onViewAllPlaces,
}: Props) {
  const [tab, setTab] = useState<Tab>(activePlaceKey ? 'Places' : 'Destinations');
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const offsets = useRef<Record<string, number>>({});

  useEffect(() => {
    if (activePlaceKey) setTab('Places');
  }, [activePlaceKey]);

  useEffect(() => {
    if (activeDestinationKey) setTab('Destinations');
  }, [activeDestinationKey]);

  const isPlaces = tab === 'Places';
  const items = isPlaces ? places : destinations;
  const activeKey = isPlaces ? activePlaceKey : activeDestinationKey;
  const icon = isPlaces ? 'map' : 'map-pin';

  // Each tab starts at the left.
  useEffect(() => {
    scrollX.current = 0;
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [tab]);

  // Bring the highlighted pill into view (for example after opening a shared link).
  useEffect(() => {
    if (!activeKey) return;
    const id = setTimeout(() => {
      const x = offsets.current[`${tab}:${activeKey}`];
      if (typeof x === 'number') {
        scrollRef.current?.scrollTo({ x: Math.max(0, x - 8), animated: true });
      }
    }, 150);
    return () => clearTimeout(id);
  }, [tab, activeKey, items.length]);

  const scrollBy = (delta: number) => {
    scrollX.current = Math.max(0, scrollX.current + delta);
    scrollRef.current?.scrollTo({ x: scrollX.current, animated: true });
  };

  return (
    <View style={styles.row}>
      <View style={styles.toggle}>
        {(['Destinations', 'Places'] as Tab[]).map((name) => {
          const selected = tab === name;
          return (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={[styles.toggleSegment, selected && styles.toggleSegmentActive]}
            >
              <Text
                style={[styles.toggleText, selected && styles.toggleTextActive]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => scrollBy(-420)} hitSlop={8} style={styles.arrow}>
        <Feather name="chevron-left" size={20} color="#111" />
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
        style={{ flex: 1 }}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {items.map((item) => {
          const selected = activeKey === item.key;
          return (
            <Pressable
              key={`${tab}:${item.key}`}
              onLayout={(event) => {
                offsets.current[`${tab}:${item.key}`] = event.nativeEvent.layout.x;
              }}
              onPress={() => (isPlaces ? onSelectPlace(item) : onSelectDestination(item))}
              style={[styles.pill, selected && styles.pillActive]}
            >
              <Feather name={icon} size={11} color="#FE2C55" />
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                {item.label}
              </Text>
              <Text style={styles.pillCount}>{item.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => scrollBy(420)} hitSlop={8} style={styles.arrow}>
        <Feather name="chevron-right" size={20} color="#111" />
      </Pressable>

      <View style={styles.viewAllSlot}>
        <Pressable
          onPress={isPlaces ? onViewAllPlaces : onViewAllDestinations}
          hitSlop={8}
        >
          <Text style={styles.viewAllText}>View all</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Same width as the "Categories:" label above, so the arrows line up for now.
  // We compare against Steve's mockup once it renders and adjust if needed.
  toggle: {
    width: 190,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    flexShrink: 0,
  },
  toggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  toggleSegmentActive: { backgroundColor: '#fff' },
  toggleText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  toggleTextActive: { color: '#000' },
  arrow: {
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
  pills: { gap: 8, paddingRight: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  pillText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pillTextActive: { color: '#000' },
  pillCount: { color: '#FE2C55', fontSize: 11, fontFamily: 'Inter_700Bold' },
  viewAllSlot: { width: 64, alignItems: 'flex-end', flexShrink: 0 },
  viewAllText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});