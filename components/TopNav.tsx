import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';

const MOBILE_BREAKPOINT = 768;

const MARKETING_LINKS = [
  { label: 'Premium', url: 'https://www.glassnik.com/glassnik-premium' },
  { label: 'Why Glassnik', url: 'https://www.glassnik.com/whyglassnik' },
  { label: 'For Videographers', url: 'https://www.glassnik.com/for-videographers' },
  { label: 'Store', url: 'https://www.glassnik.com/smart-glasses-store' },
  { label: 'Live', url: 'https://www.glassnik.com/live' },
  { label: 'Immersive', url: 'https://www.glassnik.com/immersive' },
  { label: 'About Us', url: 'https://www.glassnik.com/about-us' },
];

// App nav — same items as Sidebar.tsx, kept in sync manually since the
// hamburger menu replaces the sidebar entirely on mobile (no separate
// drawer/bottom bar there per the mobile nav spec).
//
// "Upload" is gated by requiresCreatorCap (not just loggedInOnly) — showing
// it to any logged-in user was misleading, since the Upload screen itself
// is gated behind the mobile.creator capability and would immediately show
// a "Videographer Access Required" lock screen for anyone without it.
// "Activity" (notifications) stays available to any logged-in user.
const APP_NAV_ITEMS: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: string;
  loggedInOnly?: boolean;
  requiresCreatorCap?: boolean;
}[] = [
  { label: 'Explore', icon: 'compass', route: '/(tabs)/explore' },
  { label: 'For You', icon: 'home', route: '/' },
  { label: 'Upload', icon: 'plus-square', route: '/(tabs)/upload', loggedInOnly: true, requiresCreatorCap: true },
  { label: 'Activity', icon: 'bell', route: '/(tabs)/notifications', loggedInOnly: true },
  { label: 'Profile', icon: 'user', route: '/(tabs)/profile' },
];

const FOOTER_LINKS = [
  { label: 'Company', url: 'https://www.glassnik.com/about-us' },
  { label: 'Terms and Policies', url: 'https://www.glassnik.com/terms-of-service' },
  { label: 'Support', url: 'https://www.glassnik.com/reviews' },
];

export function TopNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [menuOpen, setMenuOpen] = useState(false);

  // Same capability check used by upload.tsx, so the nav and the screen it
  // links to always agree on whether the user can actually upload.
  const { data: capabilities } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: userApi.getMyCapabilities,
    enabled: !!user,
  });
  const hasCreatorCap = capabilities?.some(
    (c: any) => c.capability?.name === 'mobile.creator' && c.status === 'ACTIVE',
  );

  const topPad = Platform.OS === 'web' ? 10 : insets.top + 6;

  const navItems = APP_NAV_ITEMS.filter((item) => {
    if (item.requiresCreatorCap && !hasCreatorCap) return false;
    if (item.loggedInOnly && !user) return false;
    return true;
  });

  function go(route: string) {
    setMenuOpen(false);
    router.push(route as any);
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  // ── Desktop — unchanged from the existing implementation ─────────────────
  if (!isMobile) {
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
            {MARKETING_LINKS.map((link) => (
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

  // ── Mobile — logo, Log In, Search, hamburger; hamburger opens a
  //     full-screen overlay containing every nav link in one place. ────────
  return (
    <View style={[styles.wrap, { paddingTop: topPad }]}>
      <View style={styles.mobileRow}>
        <Pressable style={styles.logoRow} onPress={() => router.push('/(tabs)/explore' as any)}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Glassnik</Text>
        </Pressable>

        <View style={styles.mobileRightActions}>
          <Pressable style={styles.mobileLoginBtn} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.loginText}>Log In</Text>
          </Pressable>
          <Pressable hitSlop={8}>
            <Feather name="search" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <Feather name="menu" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.menuHeader, { paddingTop: topPad }]}>
            <View style={styles.logoRow}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Glassnik</Text>
            </View>
            <Pressable hitSlop={8} onPress={() => setMenuOpen(false)}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {/* Marketing links — Glassnik website pages */}
            <View style={styles.menuSection}>
              {MARKETING_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  style={styles.menuLinkRow}
                  onPress={() => {
                    setMenuOpen(false);
                    Linking.openURL(link.url);
                  }}
                >
                  <Text style={styles.menuLinkText}>{link.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.menuDivider} />

            {/* App navigation — Glassnik app sections */}
            <View style={styles.menuSection}>
              {navItems.map((item) => {
                const isActive = pathname === item.route || (item.route === '/(tabs)/explore' && pathname === '/explore');
                return (
                  <Pressable
                    key={item.label}
                    style={[styles.menuNavItemRow, isActive && styles.menuNavItemRowActive]}
                    onPress={() => go(item.route)}
                  >
                    <Feather name={item.icon} size={16} color={isActive ? '#5eead4' : '#fff'} />
                    <Text style={[styles.menuNavItemText, isActive && styles.menuNavItemTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Log out — moved here from the Profile page action row per
                  spec, since that icon button was confirmed to be logout. */}
              {user && (
                <Pressable style={styles.menuNavItemRow} onPress={handleLogout}>
                  <Feather name="log-out" size={16} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.menuNavItemText}>Log out</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.menuDivider} />

            {/* Footer links */}
            <View style={styles.menuSection}>
              {FOOTER_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  style={styles.menuLinkRow}
                  onPress={() => {
                    setMenuOpen(false);
                    Linking.openURL(link.url);
                  }}
                >
                  <Text style={styles.menuFooterLinkText}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
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

  // ── Mobile-only styles ──────────────────────────────────────────────────
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  mobileRightActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mobileLoginBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  menuOverlay: { flex: 1, backgroundColor: '#000' },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  menuScroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  menuSection: { gap: 2 },
  menuLinkRow: { paddingVertical: 12 },
  menuLinkText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_500Medium' },
  menuFooterLinkText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  menuNavItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  menuNavItemRowActive: { backgroundColor: 'rgba(94,234,212,0.08)' },
  menuNavItemText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  menuNavItemTextActive: { color: '#5eead4' },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },
});