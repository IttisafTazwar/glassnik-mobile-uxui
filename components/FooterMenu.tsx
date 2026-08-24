import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

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

export function FooterMenu() {
  return (
    <View style={styles.wrap}>
      {FOOTER_COLUMNS.map((col) => (
        <View key={col.heading} style={styles.column}>
          <Text style={styles.heading}>{col.heading}</Text>
          {col.links.map((link) => (
            <Pressable key={link.label} onPress={() => Linking.openURL(link.url)}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <Text style={styles.disclaimer}>
        As an Amazon Associate, Glassnik earns from qualifying purchases.
      </Text>

      <View style={styles.socialRow}>
        {SOCIAL_LINKS.map((s) => (
          <Pressable key={s.icon} onPress={() => Linking.openURL(s.url)} hitSlop={8}>
            <Feather name={s.icon} size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ))}
      </View>

      <Text style={styles.copyright}>© 2026 Glassnik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 18,
  },
  column: { gap: 8 },
  heading: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  linkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 3,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    lineHeight: 14,
  },
  socialRow: { flexDirection: 'row', gap: 16 },
  copyright: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'Inter_400Regular' },
});