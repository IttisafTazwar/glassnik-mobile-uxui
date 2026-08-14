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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(
        email.trim().toLowerCase(),
        password,
        displayName.trim() || undefined,
        username.trim() || undefined,
      );
    } catch (err: any) {
      Alert.alert('Registration failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
              <Feather name="user-plus" size={26} color="#fff" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Join the Glassnik community
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.form, { paddingHorizontal: 28 }]}>
            <Field
              icon="user"
              placeholder="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              colors={colors}
            />
            <Field
              icon="at-sign"
              placeholder="Username (optional)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              colors={colors}
            />
            <Field
              icon="mail"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />

            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/auth/login" asChild>
              <Pressable>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 28, marginBottom: 32 },
  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  form: { gap: 13 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    height: '100%',
  },
  btn: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
