import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useMute } from '@/context/MuteContext';

// Local preference keys. Autoplay and push-notification toggles persist here
// but aren't yet consumed by real feed-playback or push-registration logic —
// flagged clearly rather than presented as fully wired.
//
// The Preferences UI section itself has been hidden from videographers per
// spec, but this state/persistence logic is left in place underneath in
// case it needs to be re-surfaced later.
const AUTOPLAY_KEY = 'pref:autoplay';
const PUSH_NOTIFS_KEY = 'pref:pushNotifications';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isMuted, toggleMute } = useMute();

  const [loggingOut, setLoggingOut] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  React.useEffect(() => {
    AsyncStorage.getItem(AUTOPLAY_KEY).then((v) => {
      if (v != null) setAutoplay(v === 'true');
    });
    AsyncStorage.getItem(PUSH_NOTIFS_KEY).then((v) => {
      if (v != null) setPushNotifs(v === 'true');
    });
  }, []);

  function handleToggleAutoplay(next: boolean) {
    setAutoplay(next);
    AsyncStorage.setItem(AUTOPLAY_KEY, String(next)).catch(() => {});
  }

  function handleTogglePushNotifs(next: boolean) {
    setPushNotifs(next);
    AsyncStorage.setItem(PUSH_NOTIFS_KEY, String(next)).catch(() => {});
  }

  function handleChangePassword() {
    Alert.alert(
      'Not yet available',
      'Password changes aren\'t supported yet. Contact the team if you need to reset your password.',
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account, including your Experiences, likes, comments, and followers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Not yet available', 'Account deletion isn\'t supported yet. Contact the team if you need your account removed.');
          },
        },
      ],
    );
  }

  async function performLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/auth/login');
    } catch {
      setLoggingOut(false);
    }
  }

  function handleLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        void performLogout();
      }
      return;
    }

    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void performLogout();
          },
        },
      ],
    );
  }

  const topPad = Platform.OS === 'web' ? 8 : insets.top + 8;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile section — avatar removed per spec; @username is the
            sole identifier used throughout the viewer experience. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROFILE</Text>

          <View>
            <Text style={styles.avatarName}>{user?.displayName ?? user?.email ?? ''}</Text>
            <Text style={styles.avatarSub}>@{user?.username ?? ''}</Text>
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/profile' as any)}
            style={({ pressed }) => [styles.editProfileBtn, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="edit-2" size={15} color="#fff" />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>

          <View style={styles.infoRow}>
            <Feather name="mail" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>

          <Pressable
            onPress={handleChangePassword}
            style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="lock" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.rowBtnText}>Change Password</Text>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [styles.logoutBtn, { opacity: pressed || loggingOut ? 0.7 : 1 }]}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#FE2C55" />
            ) : (
              <>
                <Feather name="log-out" size={18} color="#FE2C55" />
                <Text style={styles.logoutText}>Sign out</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text style={[styles.rowBtnText, { color: '#ef4444' }]}>Delete Account</Text>
          </Pressable>
        </View>

        {/* Preferences section — hidden from videographers per spec.
            State/persistence logic above (autoplay, pushNotifs) is left
            in place, just not rendered here. */}

        {/* App section — Version/Platform rows removed per spec; this
            technical info shouldn't be shown to videographers. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APP</Text>

          <Pressable
            onPress={() => Linking.openURL('https://glassnik.com/privacy')}
            style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.7 : 1, paddingHorizontal: 0 }]}
          >
            <Feather name="shield" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.rowBtnText}>Privacy Policy</Text>
            <Feather name="external-link" size={13} color="rgba(255,255,255,0.3)" />
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('https://glassnik.com/terms')}
            style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.7 : 1, paddingHorizontal: 0 }]}
          >
            <Feather name="file-text" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.rowBtnText}>Terms and Policies</Text>
            <Feather name="external-link" size={13} color="rgba(255,255,255,0.3)" />
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('mailto:support@glassnik.com')}
            style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.7 : 1, paddingHorizontal: 0 }]}
          >
            <Feather name="help-circle" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.rowBtnText}>Contact Support</Text>
            <Feather name="external-link" size={13} color="rgba(255,255,255,0.3)" />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },

  scroll: { flex: 1 },

  section: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 16,
    gap: 14,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
  },

  avatarName: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  avatarSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },

  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  editProfileBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Inter_400Regular' },

  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  rowBtnText: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    backgroundColor: 'rgba(254,44,85,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.25)',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  logoutText: { color: '#FE2C55', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  switchSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },

  appInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appInfoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  appInfoValue: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'Inter_500Medium' },
});