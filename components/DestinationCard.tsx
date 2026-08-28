import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  city: string;
  country: string;
  count: number;
  width: number;
  onPress?: () => void;
}

export function DestinationCard({ city, country, count, width, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width, opacity: pressed ? 0.85 : 1 }]}
      onPress={onPress}
    >
      <Text style={styles.city} numberOfLines={1}>{city}</Text>
      {country ? <Text style={styles.country} numberOfLines={1}>{country}</Text> : null}
      <Text style={styles.count}>
        {count} {count === 1 ? 'Eye-POV Experience' : 'Eye-POV Experiences'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 4,
  },
  city: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  country: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  count: { color: '#5eead4', fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
});