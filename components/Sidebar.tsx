import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  deadLink?: boolean;
};

const FOOTER_LINKS = [
  { label: 'Company', url: 'https://www.glassnik.com/about-us' },
  { label: 'Terms and Policies', url: 'https://www.glassnik.com/terms-of-service' },
  { label: 'Support', url: 'https://www.glassnik.com/reviews' },
  { label: 'Recording & Privacy', url: 'https://www.glassnik.com/recording-privacy' },
];

// Explore's sub-items — navigate to the same Explore route with a
// `discovery` query param; explore.tsx reads this to set its active tab.
const EXPLORE_CHILDREN: Leaf[] = [
  { label: 'Featured', icon: 'home', route: '/' },
  { label: 'Places', icon: 'map', route: '', deadLink: true },
  { label: 'Destinations', icon: 'map-pin', route: '', deadLink: true },
  { label: 'Categories', icon: 'grid', route: '/(tabs)/explore', discovery: 'Categories' },
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
  const { user, logout } = useAuth();

  const { data: capabilities } = useQuery({
    queryKey: ['my-capabilities'],
    queryFn: userApi.getMyCapabilities,
    enabled: !!user,
  });
  const hasCreatorCap = capabilities?.some(
    (c: any) => c.capability?.name === 'mobile.creator' && c.status === 'ACTIVE',
  );

  const onExplorePage =
    pathname === '/(tabs)/explore' || pathname === '/explore';

  const activeExploreChild =
    pathname === '/'
      ? 'Featured'
      : onExplorePage && params.discovery
        ? params.discovery
        : null;

  // expo-router returns public URL paths on web, e.g. /profile rather
  // than /(tabs)/profile. Support both forms so active states work
  // consistently across web and native navigation.
  const onProfilePage =
    pathname === '/profile' || pathname === '/(tabs)/profile';

  const onUploadPage =
    pathname === '/upload' || pathname === '/(tabs)/upload';

  const onActivityPage =
    pathname === '/notifications' || pathname === '/(tabs)/notifications';

  function goExplore(discovery?: string) {
    if (discovery) {
      router.push({ pathname: '/(tabs)/explore', params: { discovery } } as any);
    } else {
      router.push('/(tabs)/explore' as any);
    }
  }

  function goExploreChild(child: Leaf) {
    if (child.deadLink) return;

    if (child.route === '/') {
      router.push('/' as any);
      return;
    }

    if (child.discovery) {
      goExplore(child.discovery);
      return;
    }

    router.push(child.route as any);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.navGroup}>
        {/* Explore Experiences + indented sub-items */}
        <Pressable
          style={styles.navItem}
          onPress={() => {}}
        >
          <Feather
            name="compass"
            size={16}
            color="#fff"
          />
          <Text style={styles.navItemText}>
            Explore Experiences
          </Text>
        </Pressable>

        {EXPLORE_CHILDREN.map((child) => {
          const isActive = activeExploreChild === child.label;

          return (
            <Pressable
              key={child.label}
              style={[
                styles.navItemChild,
                isActive && styles.navItemActive,
              ]}
              onPress={() => goExploreChild(child)}
            >
              <Feather
                name={child.icon}
                size={14}
                color={
                  isActive
                    ? '#000'
                    : 'rgba(255,255,255,0.75)'
                }
              />
              <Text
                style={[
                  styles.navItemChildText,
                  isActive && styles.navItemTextActive,
                ]}
              >
                {child.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Profile + indented sub-items */}
        <Pressable
          style={[
            styles.navItem,
            onProfilePage && styles.navItemActive,
          ]}
          onPress={() =>
            router.push('/(tabs)/profile' as any)
          }
        >
          <Feather
            name="user"
            size={16}
            color={onProfilePage ? '#000' : '#fff'}
          />
          <Text
            style={[
              styles.navItemText,
              onProfilePage && styles.navItemTextActive,
            ]}
          >
            Profile
          </Text>
        </Pressable>

        {user && hasCreatorCap && (() => {
          const isActive = onUploadPage;

          return (
            <Pressable
              style={[
                styles.navItemChild,
                isActive && styles.navItemActive,
              ]}
              onPress={() =>
                router.push(UPLOAD_ITEM.route as any)
              }
            >
              <Feather
                name={UPLOAD_ITEM.icon}
                size={14}
                color={
                  isActive
                    ? '#000'
                    : 'rgba(255,255,255,0.75)'
                }
              />
              <Text
                style={[
                  styles.navItemChildText,
                  isActive && styles.navItemTextActive,
                ]}
              >
                Upload
              </Text>
            </Pressable>
          );
        })()}

        {user && (() => {
          const isActive = onActivityPage;

          return (
            <Pressable
              style={[
                styles.navItemChild,
                isActive && styles.navItemActive,
              ]}
              onPress={() =>
                router.push(ACTIVITY_ITEM.route as any)
              }
            >
              <Feather
                name={ACTIVITY_ITEM.icon}
                size={14}
                color={
                  isActive
                    ? '#000'
                    : 'rgba(255,255,255,0.75)'
                }
              />
              <Text
                style={[
                  styles.navItemChildText,
                  isActive && styles.navItemTextActive,
                ]}
              >
                Activity
              </Text>
            </Pressable>
          );
        })()}

        {user && (
          <Pressable
            style={styles.navItemChild}
            onPress={async () => {
              await logout();
            }}
          >
            <Feather
              name="log-out"
              size={14}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.navItemChildText}>
              Log Out
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.joinBox}>
          <View style={styles.joinIconRow}>
            <Feather name="star" size={14} color="#5eead4" />
            <Text style={styles.joinTitle}>Become a Glassnik videographer</Text>
          </View>
          <Text style={styles.joinBody}>
            Start uploading your smart-glasses Eye-POV videos and start earning.
          </Text>
          {!user && (
            <>
              <Pressable style={styles.signupBtn} onPress={() => router.push('/auth/register' as any)}>
                <Text style={styles.signupText}>Sign up</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/auth/login' as any)}>
                <Text style={styles.loginHint}>
                  Already have an account? <Text style={styles.loginHintLink}>Log in</Text>
                </Text>
              </Pressable>
            </>
          )}
        </View>

      <View style={styles.footerGroup}>
        {FOOTER_LINKS.filter((link) => Platform.OS === 'web' || link.label !== 'Recording & Privacy').map((link) => (
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
  navItemText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  navItemChildText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: 'Inter_500Medium' },
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