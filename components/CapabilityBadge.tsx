import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Capability } from '@/types';

const BADGE_ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  'mobile.creator': 'video',
  'mobile.viewer': 'eye',
  'live.creator': 'radio',
  'live.viewer': 'monitor',
  'live.subscriber': 'star',
  'glasses.subscriber': 'aperture',
  'immersive.contributor': 'layers',
};

const BADGE_COLORS: Record<string, string> = {
  'mobile.creator': '#4f87ff',
  'mobile.viewer': '#7b61ff',
  'live.creator': '#ff6b6b',
  'live.viewer': '#ffa94d',
  'live.subscriber': '#51cf66',
  'glasses.subscriber': '#20c997',
  'immersive.contributor': '#cc5de8',
};

interface CapabilityBadgeProps {
  capability: Capability;
}

export function CapabilityBadge({ capability }: CapabilityBadgeProps) {
  const colors = useColors();
  const name = capability.capability?.name ?? 'Unknown';
  const icon = BADGE_ICONS[name] ?? 'award';
  const color = BADGE_COLORS[name] ?? colors.primary;
  const isActive = capability.status === 'ACTIVE';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isActive ? `${color}22` : colors.muted,
          borderColor: isActive ? `${color}44` : colors.border,
        },
      ]}
    >
      <Feather name={icon} size={14} color={isActive ? color : colors.mutedForeground} />
      <Text
        style={[
          styles.label,
          { color: isActive ? color : colors.mutedForeground },
        ]}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
