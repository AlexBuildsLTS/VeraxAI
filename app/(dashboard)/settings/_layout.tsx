/**
 * app/(dashboard)/settings/_layout.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE & PROTOCOL (Verified: 2026-04-25)
 * 1. GPU OVERDRAW FIX: Removed `backgroundColor: 'transparent'` from contentStyle.
 * On Android, transparent stack screens force the native GPU to composite multiple
 * overlapping fragments. This causes severe performance drops, touch bleed-through,
 * and contributes to native UI thread panics during heavy Reanimated transitions.
 * 2. EXACT COLORS: Applied the strict `#010710` (Obsidian) theme hex directly
 * to the stack to guarantee zero background flashes safely and natively.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function SettingsLayout() {
  return (
    <View className="flex-1" style={{ backgroundColor: '#010710' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          /* * CRITICAL FIX: Solid background prevents Android fragment compositing crashes
           * while perfectly matching child screens to prevent transition flashes.
           */
          contentStyle: { backgroundColor: '#010710' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="security" />
        <Stack.Screen name="billing" />
        <Stack.Screen name="models" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="support" />
        <Stack.Screen name="about" />
      </Stack>
    </View>
  );
}
