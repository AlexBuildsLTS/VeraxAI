/**
 * components/layout/AdaptiveLayout.tsx
 * The Master Framework - Optimized for 2026-04-07 Production
 * ----------------------------------------------------------------------------
 * 1. UNIFIED ICON ENGINE: Cpu, Database, and Settings2 icons across all viewports.
 * 2. LAYOUT INTEGRITY: Zero changes to flow, positioning, or responsive logic.
 * 3. PRODUCTION OPTIMIZED: Native-level Web performance via injected CSS.
 */

import React from 'react';
import {
  View,
  Text,
  useWindowDimensions,
  TouchableOpacity,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { ProfileDropdown } from '../ui/ProfileDropdown';
import { cn } from '../../lib/utils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
// IMPORTING THE COMPONENTS FOR THE ICONS
import {
  Settings2,
  Cpu,
  Component,
  GalleryVerticalEnd,
} from 'lucide-react-native';

const NeuralGlow = ({ top, right, left, bottom, color }: any) => {
  const opacity = useSharedValue(0.03);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 4000 }),
        withTiming(0.03, { duration: 4000 }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          top,
          right,
          left,
          bottom,
          width: 500,
          height: 500,
          backgroundColor: color,
          borderRadius: 250,
          ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } : {}),
        },
      ]}
    />
  );
};

export const AdaptiveLayout = ({ children }: { children: React.ReactNode }) => {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // UPDATED: navItems now uses the exact Lucide components you requested
  const navItems = [
    { Icon: Component, path: '/', id: 'engine', title: 'ENGINE' },
    { Icon: GalleryVerticalEnd, path: '/history', id: 'vault', title: 'VAULT' },
    { Icon: Settings2, path: '/settings', id: 'params', title: 'SETTINGS' },
  ];

  return (
    <View
      className="flex-1 bg-[#010b1f71] relative overflow-hidden"
      style={{ flex: 1 }}
    >
      {/* Removes scrollbars for native app feel on browsers */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
                  * {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                  }
                  *::-webkit-scrollbar {
                    display: none !important;
                  }
                  html, body {
                    overflow: hidden;
                    height: 100%;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                  }
                `,
          }}
        />
      )}

      {/* 1. AMBIENT BACKGROUND */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <NeuralGlow color="#00F0FF" top="-10%" left="-10%" />
        <NeuralGlow color="#8A2BE2" bottom="-15%" right="-5%" />
      </View>

      {/* 2. MOBILE LOGO */}
      {!isDesktop && !isTablet && (
        <View className="absolute top-12 left-6 z-[1000]" pointerEvents="none">
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Profile Dropdown */}
      <View
        className="absolute top-12 right-6 z-[1000]"
        pointerEvents="box-none"
      >
        <ProfileDropdown />
      </View>

      <View className="flex-row flex-1">
        {/* 3. SIDEBAR (Desktop / Tablet) */}
        {(isDesktop || isTablet) && (
          <View
            className={cn(
              'bg-[#050508]/10 border-r border-blue/10 pt-12 items-center z-50',
              isDesktop ? 'w-24' : 'w-20',
            )}
          >
            <TouchableOpacity
              onPress={() => router.push('/')}
              className="mb-16"
            >
              <Image
                source={require('../../assets/icon.png')}
                style={{ width: 40, height: 40 }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View className="flex-1 mt-4 gap-y-12">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.path ||
                  (pathname.startsWith(item.path) && item.path !== '/');

                // Active Color is Cyan, Inactive is 20% white
                const iconColor = isActive
                  ? '#00F0FF'
                  : 'rgba(255,255,255,0.9)';

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.path as any)}
                    className="items-center"
                  >
                    <View
                      className={cn(
                        'w-12 h-12 rounded-2xl items-center justify-center transition-all',
                        isActive
                          ? 'bg-[#00F0FF]/10 border border-[#1200b8]/40 shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                          : 'bg-transparent border-transparent',
                      )}
                    >
                      {/* RENDERING THE ICON COMPONENT */}
                      <item.Icon
                        size={24}
                        color={iconColor}
                        strokeWidth={isActive ? 2.5 : 1.5}
                      />
                    </View>
                    <Text
                      className={cn(
                        'mt-2 text-[8px] font-black tracking-[3px] uppercase',
                        isActive ? 'text-[#00F0FF]' : 'text-white/50',
                      )}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 4. MAIN VIEWPORT */}
        <View className="flex-1 h-full overflow-hidden">{children}</View>
      </View>

      {/* 5. MOBILE BOTTOM NAVIGATION */}
      {!isDesktop && !isTablet && (
        <View
          className="absolute bottom-4 left-6 right-6 h-20 z-[100]"
          pointerEvents="box-none"
        >
          <BlurView
            intensity={Platform.OS === 'web' ? 20 : 60}
            tint="dark"
            className="flex-row items-center justify-around h-full rounded-[30px] border border-white/5 bg-black/5 overflow-hidden shadow-2xl"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.path ||
                (pathname.startsWith(item.path) && item.path !== '/');

              const iconColor = isActive ? '#00F0FF' : 'rgba(255,255,255,0.8)';

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => router.push(item.path as any)}
                  className="items-center justify-center w-20 h-full"
                >
                  {/* RENDERING THE SAME ICON COMPONENT ON MOBILE */}
                  <item.Icon
                    size={24}
                    color={iconColor}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {isActive && (
                    <View className="absolute bottom-4 w-1.5 h-1.5 rounded-full bg-[#00ffd5] shadow-[0_0_10px_#00F0FF]" />
                  )}
                </TouchableOpacity>
              );
            })}
          </BlurView>
        </View>
      )}
    </View>
  );
};
