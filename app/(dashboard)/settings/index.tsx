/**
 * app/(dashboard)/settings/index.tsx
 * Sovereign NorthOS Settings Dashboard
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. NATIVE SVG ANIMATION: Exact Reanimated translation of the audio/microchip SVG.
 * 2. FLUID UI/UX: Enhanced module cards with Lucide icons and hover/active states.
 * 3. RESPONSIVE ARCHITECTURE: Adapts padding, sizing, and layouts for Mobile/Web.
 * 4. AMBIENT ENGINE: Retains the neural orb background for thematic consistency.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, ShieldCheck, Cpu, ChevronRight } from 'lucide-react-native';

// ─── NATIVE SVG & REANIMATED IMPORTS ─────────────────────────────────────────
import Svg, {
  Rect,
  Path,
  Circle,
  Line,
  G,
  ClipPath,
  Defs,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  Easing,
  withSequence,
} from 'react-native-reanimated';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── AMBIENT BACKGROUND ORB ──────────────────────────────────────────────────
const NeuralOrb = ({ delay = 0, color = '#00F0FF' }) => {
  const pulse = useSharedValue(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 8000 }), -1, true),
    );
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.6]) },
      { translateX: interpolate(pulse.value, [0, 1], [0, width * 0.05]) },
      { translateY: interpolate(pulse.value, [0, 1], [0, height * 0.05]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.03, 0.09]),
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          width: 600,
          height: 600,
          backgroundColor: color,
          borderRadius: 300,
          ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : {}),
        },
      ]}
    />
  );
};

// ─── EXACT SHIELD/NETWORK SVG WITH ANIMATION ─────────────────────────────────
const AnimatedSettingsIcon = () => {
  const floatY = useSharedValue(0);
  const pulseNodes = useSharedValue(0);

  useEffect(() => {
    // 1. Shield Float Animation
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // 2. Network Nodes Pulse Animation
    pulseNodes.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [floatY, pulseNodes]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  // Pulse effect for the teal network nodes
  const nodeProps = useAnimatedProps(() => ({
    r: interpolate(pulseNodes.value, [0, 1], [10, 12]),
  }));

  // Colors matching the provided shield asset
  const C = {
    navy: '#1A3370',
    yellow: '#F3CF60',
    purple: '#C496FC',
    lightPurple: '#6A5DF1',
    teal: '#77DFCA',
    white: '#FFFFFF',
    bgCircle: '#E8E9FF',
  };

  return (
    <View
      style={{ width: 140, height: 140, alignSelf: 'center', marginBottom: 24 }}
    >
      {/* 1. Main Laptop Background (Static) */}
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: 120,
          height: 120,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          {/* Laptop Screen Body */}
          <Path
            d="M 20 50 L 20 160 L 180 160 L 180 50 Z"
            fill={C.white}
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />

          {/* Faded Background Circle behind Shield */}
          <Circle cx="100" cy="100" r="50" fill={C.bgCircle} />

          {/* Lower Purple Bar on Screen */}
          <Rect
            x="20"
            y="140"
            width="160"
            height="20"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="8"
          />

          {/* Laptop Base/Keyboard Deck */}
          <Path
            d="M 10 170 L 190 170 C 195 170 200 175 200 180 L 200 190 C 200 195 195 200 190 200 L 10 200 C 5 200 0 195 0 190 L 0 180 C 0 175 5 170 10 170 Z"
            fill={C.lightPurple}
            stroke={C.navy}
            strokeWidth="12"
          />

          {/* Trackpad Indentation */}
          <Path
            d="M 70 170 L 80 180 L 120 180 L 130 170"
            fill="none"
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      {/* 2. Floating Shield and Network Overlay (Animated) */}
      <Animated.View
        style={[
          { position: 'absolute', top: -5, left: 10, width: 120, height: 120 },
          floatStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          {/* Network Connecting Lines (Purple) */}
          <G
            stroke={C.lightPurple}
            strokeWidth="10"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <Line x1="50" y1="100" x2="80" y2="60" />
            <Line x1="150" y1="100" x2="120" y2="60" />
            <Line x1="100" y1="130" x2="100" y2="100" />
          </G>

          {/* Network Nodes (Navy outer, Teal pulsing inner) */}
          <Circle cx="50" cy="100" r="16" fill={C.navy} />
          <AnimatedCircle
            cx="50"
            cy="100"
            fill={C.teal}
            animatedProps={nodeProps}
          />

          <Circle cx="150" cy="100" r="16" fill={C.navy} />
          <AnimatedCircle
            cx="150"
            cy="100"
            fill={C.teal}
            animatedProps={nodeProps}
          />

          <Circle cx="100" cy="135" r="16" fill={C.navy} />
          <AnimatedCircle
            cx="100"
            cy="135"
            fill={C.teal}
            animatedProps={nodeProps}
          />

          {/* The Main Shield */}
          <Path
            d="M 100 110 C 130 90 135 60 135 30 L 100 20 L 65 30 C 65 60 70 90 100 110 Z"
            fill={C.yellow}
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />

          {/* The "T" inside the Shield */}
          <Path
            d="M 85 45 L 115 45 M 100 45 L 100 70"
            stroke={C.navy}
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

// ─── MODULE DATA ENHANCED WITH ICONS ─────────────────────────────────────────
const SETTING_MODULES = [
  {
    id: 'profile',
    title: 'Identity Config',
    desc: 'Avatar, Username, Bio',
    color: 'cyan',
    textClass: 'text-cyan-400',
    icon: User,
  },
  {
    id: 'security',
    title: 'Security Protocols',
    desc: 'Account Security, Keys, Biometrics',
    color: 'pink',
    textClass: 'text-rose-400',
    icon: ShieldCheck,
  },
  {
    id: 'billing',
    title: 'Resource Allocation',
    desc: 'System Tiers, Quotas, Usage',
    color: 'purple',
    textClass: 'text-purple-400',
    icon: Cpu,
  },
] as const;

// ─── MAIN SCREEN COMPONENT ───────────────────────────────────────────────────
export default function SettingsHubScreen() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  return (
    <SafeAreaView className="flex-1 bg-[#020205]">
      {/* AMBIENT BACKGROUND */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#00F0FF" />
        <NeuralOrb delay={2500} color="#FF007F" />
      </View>

      <View className="flex-1 w-full" style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            padding: isMobile ? 20 : 60,
            paddingTop: isMobile ? 120 : 100,
            paddingBottom: isMobile ? 140 : 200,
            flexGrow: 1,
            alignItems: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER SECTION WITH ANIMATED SVG */}
          <FadeIn>
            <View className="items-center w-full max-w-2xl mb-10 md:mb-16">
              <View className="px-5 py-1.5 mb-8 border rounded-full bg-cyan-500/10 border-cyan-500/20">
                <Text className="text-[9px] md:text-[10px] font-black tracking-[5px] text-cyan-400 uppercase">
                  SETTINGS
                </Text>
              </View>

              <AnimatedSettingsIcon />

              <Text
                className={cn(
                  'mt-4 font-black text-white tracking-tighter uppercase text-center leading-none',
                  isMobile ? 'text-4xl' : 'text-6xl',
                )}
              ></Text>
              <View className="h-[2px] w-20 bg-cyan-400 mt-6 md:mt-8 rounded-full shadow-[0_0_20px_#22D3EE]" />
            </View>
          </FadeIn>

          {/* SETTINGS MODULES LIST */}
          <View className="w-full max-w-2xl px-2">
            <View className="gap-y-6">
              {SETTING_MODULES.map((mod, index) => (
                <FadeIn key={mod.id} delay={index * 100}>
                  <TouchableOpacity
                    onPress={() => router.push(`/settings/${mod.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <GlassCard
                      glowColor={mod.color as 'cyan' | 'pink' | 'purple'}
                      className="flex-row items-center p-6 md:p-8 bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] transition-all rounded-3xl"
                    >
                      {/* Icon Container */}
                      <View
                        className={`w-12 h-12 rounded-full items-center justify-center mr-6 bg-${mod.color}-500/10 border border-${mod.color}-500/20`}
                      >
                        <mod.icon
                          size={22}
                          color={
                            mod.color === 'cyan'
                              ? '#22d3ee'
                              : mod.color === 'pink'
                                ? '#fb7185'
                                : '#c084fc'
                          }
                        />
                      </View>

                      {/* Text Content */}
                      <View className="flex-1">
                        <Text className="mb-2 text-lg font-bold tracking-widest text-white uppercase md:text-xl">
                          {mod.title}
                        </Text>
                        <Text className="text-[10px] md:text-xs text-white/40 font-medium uppercase tracking-[2px] md:tracking-[3px]">
                          {mod.desc}
                        </Text>
                      </View>

                      {/* Action Chevron */}
                      <View className="ml-4 items-center justify-center w-10 h-10 rounded-full bg-white/[0.02] border border-white/5">
                        <ChevronRight size={20} color="#ffffff50" />
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                </FadeIn>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
