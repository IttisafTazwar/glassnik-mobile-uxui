import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, Linking, Platform } from 'react-native';
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
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Glassnik</Text>
        </Pressable>

        <View style={styles.linksRow}>
          {NAV_LINKS.map((link) => (
            <Pressable key={link.label} onPress={() => Linking.openURL(link.url)}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rightActions}>
          <Pressable hitSlop={8}>
            <Feather name="search" size={18} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginText}>Log In</Text>
          </Pressable>
        </View>
      </View>
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
    paddingHorizontal: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  logoImage: {
  width: 40,
  height: 40,
  borderRadius: 9,
},
  logoText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  // This is the piece that makes the spread work: flex:1 makes the links
  // group take up all remaining space between the logo and the right
  // actions, and space-evenly distributes the links across that space.
  linksRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  linkText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Inter_500Medium' },

  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 18, flexShrink: 0 },
  loginBtn: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginText: { color: '#000', fontSize: 14, fontFamily: 'Inter_700Bold' },
});