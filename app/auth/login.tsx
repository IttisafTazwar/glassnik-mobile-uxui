import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { TopNav } from '@/components/TopNav';

const TIKTOK_RED = '#FE2C55';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Login failed', err?.message ?? 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && <TopNav />}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View
          style={[
            styles.inner,
            {
              paddingTop: Platform.OS === 'web' ? 32 : insets.top + 60,
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          {/* ── Logo ── */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brand}>Glassnik</Text>
            <Text style={styles.tagline}>Welcome back</Text>
            <Text style={styles.tagline}>Sign in to Glassnik</Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={TIKTOK_RED}
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                selectionColor={TIKTOK_RED}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color="rgba(255,255,255,0.4)"
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                { opacity: pressed || loading ? 0.82 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            {/* TODO — pending confirmation from Steve: keep (relabel to
                "Sign in with username") or remove entirely. Left exactly
                as-is (label + no onPress) until that's decided. */}
            <Pressable style={styles.altBtn}>
              <Feather name="user" size={16} color="#fff" />
              <Text style={styles.altBtnText}>Continue with username</Text>
            </Pressable>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Want to become a Glassnik Videographer? </Text>
            <Link href="/auth/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },

  // Logo
  header: { alignItems: 'center', gap: 8 },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 6,
  },
  brand: {
    color: '#fff',
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },

  // Form
  form: { gap: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    height: 54,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    height: '100%',
  },
  loginBtn: {
    height: 54,
    borderRadius: 10,
    backgroundColor: TIKTOK_RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Alt button
  altBtn: {
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  altBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { color: TIKTOK_RED, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});