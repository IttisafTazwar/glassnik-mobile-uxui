import React, { useEffect } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MuteProvider } from '@/context/MuteContext';
import { TopNav } from '@/components/TopNav';
import { FooterMenu } from '@/components/FooterMenu';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,   // 5 min — stops constant re-fetches on tab switch
      refetchOnWindowFocus: false, // don't re-fetch just because the user switched apps
    },
  },
});

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  // The "For You" feed (default tab, full-screen swipeable video) is the one
  // screen that must stay edge-to-edge — the persistent top nav / footer
  // would eat into the video otherwise. Every other screen gets both.
  const isFeedScreen = pathname === '/';

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'auth';
    // TEMP: bypassed for local UI preview only — no backend to authenticate against.
    // Restore this before sending any changes back to Tenzin/Pratik.
    // if (!user && !inAuthGroup) {
    //   router.replace('/auth/login');
    // } else if (user && inAuthGroup) {
    //   router.replace('/(tabs)');
    // }
  }, [user, isLoading, segments]);

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      <Stack.Screen
        name="video/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      {/* user/[id] must be outside tabs so the Profile tab doesn't stay highlighted */}
      <Stack.Screen
        name="user/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="my-videos"
        options={{ headerShown: false, presentation: 'card' }}
      />
    </Stack>
  );

  if (isFeedScreen) {
    return stack;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TopNav />
      <View style={{ flex: 1 }}>{stack}</View>
      <FooterMenu />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <MuteProvider>
                  <AuthGate />
                </MuteProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}