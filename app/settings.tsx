import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              // Auth context will clear user; root layout redirects to login
            } catch {
              setLoggingOut(false);
            }
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
        {/* Profile section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROFILE</Text>

          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(user?.displayName ?? user?.email ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.avatarName}>{user?.displayName ?? user?.email ?? ''}</Text>
              <Text style={styles.avatarSub}>@{user?.username ?? ''}</Text>
            </View>
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
        </View>

        {/* App section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APP</Text>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Version</Text>
            <Text style={styles.appInfoValue}>1.0.0</Text>
          </View>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Platform</Text>
            <Text style={styles.appInfoValue}>{Platform.OS}</Text>
          </View>
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

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FE2C55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
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

  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 15, fontFamily: 'Inter_700Bold' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Inter_400Regular' },

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

  appInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appInfoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  appInfoValue: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'Inter_500Medium' },
});