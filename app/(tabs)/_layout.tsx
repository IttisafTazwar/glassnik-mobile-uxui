import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { notificationsApi } from '@/lib/api';
import { UploadGuardProvider, useUploadGuard } from '@/context/UploadGuardContext';

/**
 * Wraps any tab bar button with an upload guard. When an upload is in progress,
 * pressing this button shows a confirmation dialog instead of navigating away.
 * Only used for non-upload tabs in ClassicTabLayout.
 */
function GuardedTabButton({ onPress, ...rest }: any) {
  const { isGuardActive, cancelUploadRef, intentionalLeaveRef } = useUploadGuard();

  const handlePress = () => {
    if (isGuardActive) {
      Alert.alert(
        'Upload in progress',
        'Leaving will pause your upload. Resume next time you visit this screen.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              intentionalLeaveRef.current = true;
              cancelUploadRef.current?.();
              onPress?.();
            },
          },
        ],
      );
    } else {
      onPress?.();
    }
  };

  return <Pressable {...rest} onPress={handlePress} />;
}

// TikTok-style + button for the Upload tab
function UploadTabButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.uploadBtn, { opacity: pressed ? 0.8 : 1 }]}
      hitSlop={8}
    >
      {/* TikTok dual-color pill effect */}
      <View style={styles.uploadPillShadowLeft} />
      <View style={styles.uploadPillShadowRight} />
      <View style={styles.uploadPillCenter}>
        <Feather name="plus" size={22} color="#000" />
      </View>
    </Pressable>
  );
}

/** Bell icon that shows an unread count badge (polls every 30 s). */
function NotificationTabIcon({ color }: { color: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
    retry: false,
    staleTime: 10_000,
  });
  const count = data?.count ?? 0;

  return (
    <View style={{ position: 'relative' }}>
      <Feather name="bell" size={24} color={color} />
      {count > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{count > 99 ? '99' : count}</Text>
        </View>
      )}
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>For You</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass.circle.fill' }} />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="upload">
        <Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />
        <Label>Upload</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <Label>Activity</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const safeAreaInsets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';
  const tabBarHeight = isWeb ? 62 : 56 + safeAreaInsets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : 'rgba(0,0,0,0.92)',
          borderTopColor: 'rgba(255,255,255,0.12)',
          borderTopWidth: 0.5,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 8 : safeAreaInsets.bottom,
          paddingTop: 6,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.92)' }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'For You',
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
          tabBarButton: (props) => <GuardedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Feather name="search" size={24} color={color} />,
          tabBarButton: (props) => <GuardedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: ({ onPress }) => (
            <UploadTabButton onPress={onPress ? () => (onPress as any)() : undefined} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <NotificationTabIcon color={color} />,
          tabBarButton: (props) => <GuardedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
          tabBarButton: (props) => <GuardedTabButton {...props} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <UploadGuardProvider>
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
    </UploadGuardProvider>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },

  // Upload (center) button
  uploadBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPillShadowLeft: {
    position: 'absolute',
    width: 52,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#69C9D0',
    left: '50%',
    marginLeft: -30,
  },
  uploadPillShadowRight: {
    position: 'absolute',
    width: 52,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FE2C55',
    left: '50%',
    marginLeft: -22,
  },
  uploadPillCenter: {
    width: 48,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  // Notification badge
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FE2C55',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
  },
});