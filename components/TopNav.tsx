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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable style={styles.logoRow} onPress={() => router.push('/(tabs)/explore' as any)}>
          <View style={styles.logoIcon}>
            <Feather name="aperture" size={16} color="#5eead4" />
          </View>
          <Text style={styles.logoText}>Glassnik</Text>
        </Pressable>

        {NAV_LINKS.map((link) => (
          <Pressable
            key={link.label}
            style={styles.linkBtn}
            onPress={() => Linking.openURL(link.url)}
          >
            <Text style={styles.linkText}>{link.label}</Text>
          </Pressable>
        ))}

        <Pressable hitSlop={8} style={styles.iconBtn}>
          <Feather name="search" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>

        <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login' as any)}>
          <Text style={styles.loginText}>Log In</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 32,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  logoIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  linkBtn: { paddingVertical: 4 },
  linkText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Inter_500Medium' },
  iconBtn: { paddingHorizontal: 4 },
  loginBtn: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginText: { color: '#000', fontSize: 14, fontFamily: 'Inter_700Bold' },
});