import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';

type Leaf = {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: string;
  discovery?: string; // query param value for Explore sub-items
};

const FOOTER_LINKS = [
  { label: 'Company', url: 'https://www.glassnik.com/about-us' },
  { label: 'Terms and Policies', url: 'https://www.glassnik.com/terms-of-service' },
  { label: 'Support', url: 'https://www.glassnik.com/reviews' },
];

// Explore's sub-items — navigate to the same Explore route with a
// `discovery` query param; explore.tsx reads this to set its active tab.
const EXPLORE_CHILDREN: Leaf[] = [
  { label: 'Trending', icon: 'trending-up', route: '/(tabs)/explore', discovery: 'Trending' },
  { label: 'Nearby', icon: 'map-pin', route: '/(tabs)/explore', discovery: 'Nearby' },
  { label: 'Global', icon: 'globe', route: '/(tabs)/explore', discovery: 'Global' },
];

// Profile's sub-items — shown only when the user is logged in AND has the
// videographer (mobile.creator) capability, per spec.
const UPLOAD_ITEM: Leaf = {
  label: 'Upload',
  icon: 'plus-square',
  route: '/(tabs)/upload',
};

const ACTIVITY_ITEM: Leaf = {
  label: 'Activity',
  icon: 'bell',
  route: '/(tabs)/notifications',
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ discovery?: string }>();
  const { user } = useAuth();

  const { data: capabilities } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: userApi.getMyCapabilities,
    enabled: !!user,
  });
  const hasCreatorCap = capabilities?.some(
    (c: any) => c.capability?.name === 'mobile.creator' && c.status === 'ACTIVE',
  );

  const onExplorePage = pathname === '/(tabs)/explore' || pathname === '/explore';
  const currentDiscovery = onExplorePage ? (params.discovery ?? 'Explore') : null;

  function goExplore(discovery?: string) {
    if (discovery) {
      router.push({ pathname: '/(tabs)/explore', params: { discovery } } as any);
    } else {
      router.push('/(tabs)/explore' as any);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.navGroup}>
        {/* Explore + indented sub-items */}
        <Pressable
          style={[styles.navItem, onExplorePage && currentDiscovery === 'Explore' && styles.navItemActive]}
          onPress={() => goExplore()}
        >
          <Feather name="compass" size={16} color={onExplorePage && currentDiscovery === 'Explore' ? '#000' : '#fff'} />
          <Text style={[styles.navItemText, onExplorePage && currentDiscovery === 'Explore' && styles.navItemTextActive]}>
            Explore
          </Text>
        </Pressable>

        {EXPLORE_CHILDREN.map((child) => {
          const isActive = onExplorePage && currentDiscovery === child.discovery;
          return (
            <Pressable
              key={child.label}
              style={[styles.navItemChild, isActive && styles.navItemActive]}
              onPress={() => goExplore(child.discovery)}
            >
              <Feather name={child.icon} size={14} color={isActive ? '#000' : 'rgba(255,255,255,0.75)'} />
              <Text style={[styles.navItemChildText, isActive && styles.navItemTextActive]}>{child.label}</Text>
            </Pressable>
          );
        })}

        {/* For You */}
        <Pressable
          style={[styles.navItem, pathname === '/' && styles.navItemActive]}
          onPress={() => router.push('/' as any)}
        >
          <Feather name="home" size={16} color={pathname === '/' ? '#000' : '#fff'} />
          <Text style={[styles.navItemText, pathname === '/' && styles.navItemTextActive]}>For You</Text>
        </Pressable>

        {/* Profile + indented sub-items (logged-in videographers only) */}
        <Pressable
          style={[styles.navItem, pathname === '/(tabs)/profile' && styles.navItemActive]}
          onPress={() => router.push('/(tabs)/profile' as any)}
        >
          <Feather name="user" size={16} color={pathname === '/(tabs)/profile' ? '#000' : '#fff'} />
          <Text style={[styles.navItemText, pathname === '/(tabs)/profile' && styles.navItemTextActive]}>
            Profile
          </Text>
        </Pressable>

        {user && hasCreatorCap && (() => {
          const isActive = pathname === UPLOAD_ITEM.route;
          return (
            <Pressable
              style={[styles.navItemChild, isActive && styles.navItemActive]}
              onPress={() => router.push(UPLOAD_ITEM.route as any)}
            >
              <Feather name={UPLOAD_ITEM.icon} size={14} color={isActive ? '#000' : 'rgba(255,255,255,0.75)'} />
              <Text style={[styles.navItemChildText, isActive && styles.navItemTextActive]}>Upload</Text>
            </Pressable>
          );
        })()}

        {user && (() => {
          const isActive = pathname === ACTIVITY_ITEM.route;
          return (
            <Pressable
              style={[styles.navItemChild, isActive && styles.navItemActive]}
              onPress={() => router.push(ACTIVITY_ITEM.route as any)}
            >
              <Feather name={ACTIVITY_ITEM.icon} size={14} color={isActive ? '#000' : 'rgba(255,255,255,0.75)'} />
              <Text style={[styles.navItemChildText, isActive && styles.navItemTextActive]}>Activity</Text>
            </Pressable>
          );
        })()}
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
  // Indented ~18px, per spec.
  navItemChild: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 18,
    borderRadius: 8,
  },
  navItemActive: { backgroundColor: '#fff' },
  navItemText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  navItemChildText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_500Medium' },
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