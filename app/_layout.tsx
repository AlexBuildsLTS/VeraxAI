/**
 * app/_layout.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Root routing topology, global provider wrapper, and Premium Splash Handoff.
 * Uses expo-image to render a transparent SVG/GIF over the dark theme.
 */
import '../lib/polyfill';
import 'react-native-gesture-handler';
import '../global.css';

import React, { useEffect, useState, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/useAuthStore';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { ProcessingLoader } from '../components/ui/ProcessingLoader';

// 1. Freeze the static image immediately so it doesn't flash
SplashScreen.preventAutoHideAsync().catch(() => {});

const NeonDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#020205',
    card: '#05050A',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#FFFFFF',
  },
};

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();

  // Auth & Routing State
  const { initialize, isLoading, session } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Query Client
  const [queryClient] = useState(() => new QueryClient());

  // Splash State - Auto-finish if on Web!
  const [splashFinished, setSplashFinished] = useState(Platform.OS === 'web');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 2. Theme & Auth Initialization
  useEffect(() => {
    setColorScheme('dark');
  }, [setColorScheme]);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  // 3. SINGLE SOURCE OF TRUTH ROUTING LOGIC
  useEffect(() => {
    if (isLoading) return;

    // Once auth is loaded, hide the static PNG. The transparent SVG is now showing.
    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === '(auth)';

    if (session && inAuthGroup) {
      router.replace('/(dashboard)');
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [session, isLoading, segments, router]);

  // 4. Trigger the fade out of the transparent SVG
  useEffect(() => {
    if (Platform.OS === 'web') {
      setSplashFinished(true);
      return;
    }

    if (!isLoading) {
      // Let the SVG/GIF play for 1.5 seconds, then fade it out
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0, // Fade opacity to 0
          duration: 500, // Buttery smooth half-second fade
          useNativeDriver: true,
        }).start(() => {
          setSplashFinished(true); // Unmount overlay
        });
      }, 1500);
    }
  }, [isLoading]);

  // Prevent rendering the actual UI tree until Auth is resolved
  if (isLoading && Platform.OS === 'web') {
    return <View style={{ flex: 1, backgroundColor: '#020205' }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NeonDarkTheme}>
        <StatusBar style="light" />

        <View style={{ flex: 1, backgroundColor: '#020205' }}>
          {/* YOUR ACTUAL APP ROUTING */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#020205' },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(dashboard)" options={{ animation: 'fade' }} />
          </Stack>

          {/* THE TRANSPARENT SVG OVERLAY (Native Only) */}
          {Platform.OS !== 'web' && !splashFinished && (
            <Animated.View
              style={[styles.splashOverlay, { opacity: fadeAnim }]}
              pointerEvents="none"
            >
              <ProcessingLoader size={120} color="#00F0FF" />
            </Animated.View>
          )}
        </View>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#020205',
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
