import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const ALWAYS_VISIBLE_ITEMS: { label: string; icon: React.ComponentProps<typeof Feather>['name']; route: string }[] = [
  { label: 'Explore', icon: 'compass', route: '/(tabs)/explore' },
  { label: 'For You', icon: 'home', route: '/' },
];

const LOGGED_IN_ONLY_ITEMS: { label: string; icon: React.ComponentProps<typeof Feather>['name']; route: string }[] = [
  { label: 'Upload', icon: 'plus-square', route: '/(tabs)/upload' },
  { label: 'Activity', icon: 'bell', route: '/(tabs)/notifications' },
];

const PROFILE_ITEM = { label: 'Profile', icon: 'user' as const, route: '/(tabs)/profile' };

const FOOTER_LINKS = [
  { label: 'Company', url: 'https://www.glassnik.com/about-us' },
  { label: 'Terms and Policies', url: 'https://www.glassnik.com/terms-of-service' },
  { label: 'Support', url: 'https://www.glassnik.com/reviews' },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    ...ALWAYS_VISIBLE_ITEMS,
    ...(user ? LOGGED_IN_ONLY_ITEMS : []),
    PROFILE_ITEM,
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.navGroup}>
        {navItems.map((item) => {
          const isActive = pathname === item.route || (item.route === '/(tabs)/explore' && pathname === '/explore');
          return (
            <Pressable
              key={item.label}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
            >
              <Feather name={item.icon} size={16} color={isActive ? '#000' : '#fff'} />
              <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!user && (
        <View style={styles.joinBox}>
          <View style={styles.joinIconRow}>
            <Feather name="star" size={14} color="#5eead4" />
            <Text style={styles.joinTitle}>Become a Glassnik videographer</Text>
          </View>
          <Text style={styles.joinBody}>
            Start exploring real Eye-POV experiences from around the world.
          </Text>
          <Pressable style={styles.signupBtn} onPress={() => router.push('/auth/register' as any)}>
            <Text style={styles.signupText}>Sign up</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginHint}>
              Already have an account? <Text style={styles.loginHintLink}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footerGroup}>
        {FOOTER_LINKS.map((link) => (
          <Pressable key={link.label} onPress={() => Linking.openURL(link.url)} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>{link.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.copyright}>© 2026 Glassnik</Text>
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 260;
export { SIDEBAR_WIDTH };

const styles = StyleSheet.create({
  wrap: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#000',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  navGroup: { gap: 2 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
  },
  navItemActive: { backgroundColor: '#fff' },
  navItemText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  navItemTextActive: { color: '#000' },

  joinBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    gap: 8,
    marginTop: 16,
  },
  joinIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  joinBody: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  signupBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  signupText: { color: '#000', fontSize: 12, fontFamily: 'Inter_700Bold' },
  loginHint: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Inter_400Regular' },
  loginHintLink: { color: '#5eead4', fontFamily: 'Inter_600SemiBold' },

  footerGroup: { gap: 6, marginBottom: 16 },
  footerLink: { paddingVertical: 3 },
  footerLinkText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  copyright: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 4 },
});