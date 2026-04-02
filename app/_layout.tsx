/**
 * app/_layout.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Root routing topology and global provider wrapper.
 * Enforces the NeonDarkTheme across the React Navigation layer to prevent
 * white flashes during nested navigator transitions.
 */
import 'react-native-gesture-handler';
import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client';
import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';

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

const queryClient = new QueryClient();

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  const { initialize, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    setColorScheme('dark');
  }, [setColorScheme]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, newSession: Session | null) => {
        const inAuthGroup = segments[0] === '(auth)';

        if (newSession && inAuthGroup) {
          router.replace('/(dashboard)');
        } else if (!newSession && !inAuthGroup) {
          router.replace('/(auth)/sign-in');
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#020205] items-center justify-center">
        <ActivityIndicator size="large" color="#00F0FF" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NeonDarkTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#020205' },
          }}
        >
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(dashboard)" options={{ animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
