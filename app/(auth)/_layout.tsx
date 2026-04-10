
/**
 * AuthLayout handles the routing logic for unauthenticated users.
 * If a session is detected, it automatically redirects to the dashboard.
 */

import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

const AuthLayout = () => {
  const { session, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/(dashboard)');
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#01193da9] items-center justify-center">
        <View className="w-12 h-12 border-4 border-[#00F0FF]/20 border-t-[#00F0FF] rounded-full animate-spin" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#010b22]">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="sign-in" />
      </Stack>
    </View>
  );
};

export default AuthLayout;