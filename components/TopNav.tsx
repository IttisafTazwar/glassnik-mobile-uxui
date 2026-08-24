import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const NAV_LINKS = [
  { label: 'Premium', url: 'https://www.glassnik.com/glassnik-premium' },
  { label: 'Why Glassnik', url: 'https://www.glassnik.com/whyglassnik' },
  { label: 'For Videographers', url: 'https://www.glassnik.com/for-videographers' },
  { label: 'Store', url: 'https://www.glassnik.com/smart-glasses-store' },
  { label: 'Live', url: 'https://www.glassnik.com/live' },
  { label: 'Immersive', url: 'https://www.glassnik.com/immersive' },
  { label: 'About Us', url: 'https://www.glassnik.com/about-us' },
];

export function TopNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 10 : insets.top + 6;

  return (
    <View style={[styles.wrap, { paddingTop: topPad }]}>
      <View style={styles.row}>
        <Pressable style={styles.logoRow} onPress={() => router.push('/(tabs)/explore' as any)}>
          <View style={styles.logoIcon}>
            <Feather name="aperture" size={16} color="#5eead4" />
          </View>
          <Text style={styles.logoText}>Glassnik</Text>
        </Pressable>

        <View style={styles.rightActions}>
          <Pressable hitSlop={8} onPress={() => router.push('/(tabs)/explore' as any)}>
            <Feather name="search" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginText}>Log In</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.linksRow}
      >
        {NAV_LINKS.map((link) => (
          <Pressable
            key={link.label}
            style={styles.linkBtn}
            onPress={() => Linking.openURL(link.url)}
          >
            <Text style={styles.linkText}>{link.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  loginBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loginText: { color: '#000', fontSize: 12, fontFamily: 'Inter_700Bold' },
  linksRow: { paddingHorizontal: 16, gap: 18 },
  linkBtn: { paddingVertical: 2 },
  linkText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_500Medium' },
});