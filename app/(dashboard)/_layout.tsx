import { Stack } from 'expo-router';
import { AdaptiveLayout } from '../../components/layout/AdaptiveLayout';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

export default function DashboardLayout() {
  return (
    <View className="flex-1 bg-[#020205]">  
      <AdaptiveLayout>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="video/[id]" />
          <Stack.Screen name="history" />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack>
      </AdaptiveLayout>
    </View>
  );
}
