/**
 * app/(dashboard)/settings/_layout.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Deep-level settings routing.
 * Nested transparency ensures zero background flashes during transitions
 */
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function SettingsLayout() {
  return (
    <View className="flex-1 bg-background">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="security" />
        <Stack.Screen name="billing" />
        <Stack.Screen name="support" />
      </Stack>
    </View>
  );
}