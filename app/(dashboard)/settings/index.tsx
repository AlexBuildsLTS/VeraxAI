/**
 * app/(dashboard)/settings/index.tsx
 * VeraxAI Settings Dashboard
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL:
 * 1. TOUCH TARGET RESOLUTION: Explicit `style={{ width: '100%' }}` applied
 * directly to TouchableOpacity to preserve strict TypeScript props compliance.
 * 2. GESTURE DELEGATION: ScrollView utilizes `keyboardShouldPersistTaps="handled"`
 * to ensure taps on cards execute instantly without dropping frames.
 * 3. EVENT ISOLATION: The ambient background strictly enforces `pointerEvents="none"`
 * across all nested nodes to prevent gesture hijacking on the Z-axis.
 * 4. STRICT THEMING: Exact user-provided hex codes mapped. Zero mock data injected.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { memo, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── ICONOGRAPHY ─────────────────────────────────────────────────────────────
import {
  User,
  ShieldCheck,
  Cpu,
  ChevronRight,
  LifeBuoy,
  Terminal,
  ArrowBigLeftDash,
  LucideIcon,
} from 'lucide-react-native';

// ─── STATE & UI COMPONENTS ───────────────────────────────────────────────────
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';
import { useAuthStore } from '../../../store/useAuthStore';

// ─── ANIMATIONS & NATIVE SVG ─────────────────────────────────────────────────
import Svg, { Rect, Path, Circle, Line, G } from 'react-native-svg';
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
  useFrameCallback,
} from 'react-native-reanimated';

// ─── THEME CONSTANTS & TYPES ─────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const THEME = {
  obsidian: '#010710',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#048766',
  red: '#FF3333',
} as const;

const IS_WEB = Platform.OS === 'web';
type GlowColor = 'cyan' | 'pink' | 'purple' | 'green' | 'red';

interface SettingsCardItem {
  id: string;
  title: string;
  desc: string;
  color: GlowColor;
  iconHex: string;
  icon: LucideIcon;
  customBg?: string;
  customBorder?: string;
  routeOverride?: Href;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT PHYSICS ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const SingleRipple = memo(({ color, delay, duration, maxSize }: any) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.sin) }),
        -1,
        false,
      ),
    );
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, maxSize]),
    height: interpolate(progress.value, [0, 1], [0, maxSize]),
    borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
    opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 0.15, 0.02, 0]),
    borderWidth: interpolate(progress.value, [0, 1], [60, 20]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          borderColor: color,
          backgroundColor: 'transparent',
        },
        animatedStyle,
      ]}
    />
  );
});
SingleRipple.displayName = 'SingleRipple';

const WanderingCore = memo(
  ({ coreSize, color, maxWaveSize, waveCount, baseDuration }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 3000;
    });

    const animatedPosition = useAnimatedStyle(() => ({
      transform: [
        { translateX: width / 2 + Math.sin(time.value * 0.4) * (width * 0.3) },
        {
          translateY: height / 2 + Math.cos(time.value * 0.3) * (height * 0.2),
        },
      ],
    }));

    const corePulse = useSharedValue(0.4);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, [corePulse]);

    const coreStyle = useAnimatedStyle(() => ({
      opacity: interpolate(corePulse.value, [0.4, 1], [0.4, 1]),
      transform: [
        { scale: interpolate(corePulse.value, [0.4, 1], [0.8, 1.2]) },
      ],
    }));

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedPosition,
        ]}
      >
        {Array.from({ length: waveCount }).map((_, index) => (
          <SingleRipple
            key={`ripple-${index}`}
            color={color}
            delay={index * (baseDuration / waveCount)}
            duration={baseDuration}
            maxSize={maxWaveSize}
          />
        ))}
        <Animated.View
          pointerEvents="none"
          style={[
            coreStyle,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
              ...(IS_WEB
                ? ({ boxShadow: `0 0 20px ${color}` } as any)
                : {
                    shadowColor: color,
                    shadowRadius: 15,
                    shadowOpacity: 1,
                    shadowOffset: { width: 0, height: 0 },
                  }),
            },
          ]}
        />
      </Animated.View>
    );
  },
);
WanderingCore.displayName = 'WanderingCore';

const OrganicOrb = memo(
  ({
    color,
    size,
    initialX,
    initialY,
    speedX,
    speedY,
    phaseOffsetX,
    phaseOffsetY,
    opacityBase,
  }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 1000;
    });

    const animatedStyle = useAnimatedStyle(() => {
      const xOffset =
        Math.sin(time.value * speedX + phaseOffsetX) * (width * 0.3);
      const yOffset =
        Math.cos(time.value * speedY + phaseOffsetY) * (height * 0.2);
      const breathe = 1 + Math.sin(time.value * 0.5) * 0.15;
      return {
        transform: [
          { translateX: initialX + xOffset },
          { translateY: initialY + yOffset },
          { scale: breathe },
        ],
        opacity: opacityBase + Math.sin(time.value * 0.5) * 0.02,
      };
    });

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -size / 2,
            left: -size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            ...(IS_WEB ? ({ filter: 'blur(60px)' } as any) : {}),
          },
          animatedStyle,
        ]}
      />
    );
  },
);
OrganicOrb.displayName = 'OrganicOrb';

const AmbientArchitecture = memo(
  ({ color = THEME.green, bottom, right }: any) => {
    const { width, height } = Dimensions.get('window');
    const massiveWaveRadius = width >= 1024 ? width * 0.8 : height * 1.0;

    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { bottom: bottom ?? 0, right: right ?? 0 },
        ]}
        pointerEvents="none"
      >
        <OrganicOrb
          color={THEME.pink}
          size={width * 0.6}
          initialX={width * 0.8}
          initialY={height * 0.6}
          speedX={0.15}
          speedY={0.2}
          phaseOffsetX={Math.PI}
          phaseOffsetY={0}
          opacityBase={0.06}
        />
        <OrganicOrb
          color={THEME.cyan}
          size={width * 0.4}
          initialX={width * 0.5}
          initialY={height * 0.8}
          speedX={0.25}
          speedY={0.1}
          phaseOffsetX={Math.PI / 4}
          phaseOffsetY={Math.PI}
          opacityBase={0.04}
        />
  {/*
 * VeraxAI Core Animation settings/index
 * ══════════════════════════════════════════════════════════════════════════════
 * <WanderingCore
 * coreSize={14}
 * color={color}
 * maxWaveSize={massiveWaveRadius}
 * baseDuration={12000}
 * />
 */}
      </View>
    );
  },
);
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: HEADER SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

const AnimatedSettingsIcon = memo(() => {
  const floatY = useSharedValue(0);
  const pulseNodes = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    pulseNodes.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const nodeProps = useAnimatedProps(() => ({
    r: interpolate(pulseNodes.value, [0, 1], [12, 18]),
  }));

  const C = {
    navy: '#050B14',
    yellow: '#F3CF60',
    purple: '#C496FC',
    lightPurple: '#6A5DF1',
    teal: '#77DFCA',
    white: '#FFFFFF',
    bgCircle: '#E8E9FF',
  };

  return (
    <View
      pointerEvents="none"
      style={{ width: 140, height: 140, alignSelf: 'center', marginBottom: 24 }}
    >
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
          <Path
            d="M 20 50 L 20 160 L 180 160 L 180 50 Z"
            fill={C.white}
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <Circle cx="100" cy="100" r="50" fill={C.bgCircle} />
          <Rect
            x="20"
            y="140"
            width="160"
            height="20"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="8"
          />
          <Path
            d="M 10 170 L 190 170 C 195 170 200 175 200 180 L 200 190 C 200 195 195 200 190 200 L 10 200 C 5 200 0 195 0 190 L 0 180 C 0 175 5 170 10 170 Z"
            fill={C.lightPurple}
            stroke={C.navy}
            strokeWidth="12"
          />
          <Path
            d="M 70 170 L 80 180 L 120 180 L 130 170"
            fill="none"
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Animated.View
        style={[
          { position: 'absolute', top: -5, left: 10, width: 120, height: 120 },
          floatStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
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
          <Path
            d="M 100 110 C 130 90 135 60 135 30 L 100 20 L 65 30 C 65 60 70 90 100 110 Z"
            fill={C.yellow}
            stroke={C.navy}
            strokeWidth="12"
            strokeLinejoin="round"
          />
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
});
AnimatedSettingsIcon.displayName = 'AnimatedSettingsIcon';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: MAIN SCREEN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsHubScreen() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  const { profile } = useAuthStore();
  const userRole = profile?.role || 'member';

  const SETTING_MODULES: SettingsCardItem[] = useMemo(() => {
    const modules: SettingsCardItem[] = [
      {
        id: 'profile',
        title: 'USER',
        desc: 'Avatar, Bio',
        color: 'cyan',
        iconHex: THEME.cyan,
        icon: User,
        customBg: `${THEME.cyan}08`,
        customBorder: `${THEME.cyan}25`,
        routeOverride: '/settings/profile' as Href,
      },
      {
        id: 'security',
        title: 'Security',
        desc: 'Account Security, Biometrics, API Keys',
        color: 'pink',
        iconHex: THEME.pink,
        icon: ShieldCheck,
        customBg: `${THEME.pink}08`,
        customBorder: `${THEME.pink}25`,
        routeOverride: '/settings/security' as Href,
      },
      {
        id: 'billing',
        title: 'BILLING & TOKENS',
        desc: 'System Tiers, Quotas, Usage',
        color: 'purple',
        iconHex: THEME.purple,
        icon: Cpu,
        customBg: `${THEME.purple}08`,
        customBorder: `${THEME.purple}25`,
        routeOverride: '/settings/billing' as Href,
      },
      {
        id: 'support',
        title: 'SUPPORT',
        desc: 'Help Desk, Active Tickets',
        color: 'green',
        iconHex: THEME.green,
        icon: LifeBuoy,
        customBg: `${THEME.green}08`,
        customBorder: `${THEME.green}25`,
        routeOverride: '/settings/support' as Href,
      },
    ];

    if (userRole === 'admin') {
      modules.push({
        id: 'admin',
        title: 'ADMIN',
        desc: 'Global Telemetry, User Directory',
        color: 'red',
        iconHex: THEME.red,
        icon: Terminal,
        customBg: `${THEME.red}08`,
        customBorder: `${THEME.red}25`,
        routeOverride: '/admin' as Href,
      });
    }

    return modules;
  }, [userRole]);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.obsidian }}>
      <AmbientArchitecture />

      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            {
              flexGrow: 1,
              alignItems: 'center',
            },
            {
              padding: isMobile ? 16 : 60,
              paddingTop: isMobile ? 60 : 80,
              paddingBottom: isMobile ? 140 : 200,
            },
          ]}
        >
          {/* ── HEADER ── */}
          <FadeIn>
            <View className="items-center w-full mb-10 md:mb-16">
              <View className="px-5 py-1.5 mb-8 border rounded-full bg-[#00F0FF]/10 border-[#00F0FF]/20">
                <Text className="text-[9px] md:text-[10px] font-black tracking-[5px] text-[#00F0FF] uppercase">
                  SETTINGS
                </Text>
              </View>
              <AnimatedSettingsIcon />
              <View className="h-[2px] w-20 bg-[#00F0FF] mt-6 md:mt-8 rounded-full shadow-[0_0_20px_#00F0FF]" />
            </View>
          </FadeIn>

          {/* ── BACK BUTTON ── */}
          <View className="flex-row items-center justify-between w-full max-w-2xl px-4 py-4 md:px-8">
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/')
              }
              className="flex-row items-center px-4 py-4 mb-10 gap-x-2"
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <ArrowBigLeftDash size={18} color={THEME.cyan} />
            </TouchableOpacity>
          </View>

          {/* ── MODULE CARDS ── */}
          <View className="w-full max-w-2xl px-2" pointerEvents="box-none">
            <View
              className="w-full gap-y-4 md:gap-y-6"
              pointerEvents="box-none"
            >
              {SETTING_MODULES.map((mod, index) => (
                <FadeIn key={mod.id} delay={index * 100}>
                  <TouchableOpacity
                    onPress={() =>
                      mod.routeOverride && router.push(mod.routeOverride)
                    }
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: '100%' }}
                  >
                    <GlassCard
                      glowColor={mod.color}
                      style={[
                        mod.customBg
                          ? {
                              backgroundColor: mod.customBg,
                              borderColor: mod.customBorder,
                              borderWidth: 1,
                            }
                          : {},
                        { width: '100%' },
                      ]}
                      className="flex-row items-center justify-between w-full p-4 transition-all md:p-8 rounded-3xl"
                    >
                      <View
                        className="flex-row items-center flex-1 pr-2 shrink"
                        pointerEvents="none"
                      >
                        {/* Dynamic Icon Container */}
                        <View
                          style={
                            mod.customBg
                              ? {
                                  backgroundColor: mod.iconHex + '15',
                                  borderColor: mod.iconHex + '30',
                                  borderWidth: 1,
                                }
                              : {}
                          }
                          className={cn(
                            'w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center mr-4',
                            !mod.customBg &&
                              `bg-${mod.color}-500/10 border border-${mod.color}-500/20`,
                          )}
                        >
                          <mod.icon size={20} color={mod.iconHex} />
                        </View>

                        {/* Text Metadata */}
                        <View className="flex-1 shrink">
                          <Text
                            className="mb-1 text-sm font-bold tracking-wider text-white uppercase md:tracking-widest md:text-xl"
                            numberOfLines={2}
                          >
                            {mod.title}
                          </Text>
                          <Text
                            className="text-[9px] md:text-xs text-white/40 font-medium uppercase tracking-widest md:tracking-[3px]"
                            numberOfLines={2}
                          >
                            {mod.desc}
                          </Text>
                        </View>
                      </View>

                      {/* Navigation Arrow */}
                      <View
                        className="items-center justify-center w-8 h-8 rounded-full md:w-10 md:h-10 bg-white/[0.02] border border-white/5 shrink-0"
                        pointerEvents="none"
                      >
                        <ChevronRight size={18} color="#ffffff50" />
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                </FadeIn>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
