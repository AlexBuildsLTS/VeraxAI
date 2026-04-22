/**
 * app/(dashboard)/admin/keys.tsx
 * VeraxAI — API Key Vault ( FALLBACK APIS)  & Telemetry Analytics
 * ══════════════════════════════════════════════════════════════════════════════
 * Architect:
 * CRASH-PROOF CHARTS: SVG handles static rendering; Reanimated handles HTML overlays.
 * ADAPTIVE SCALING: Mobile-optimized LED bars and Bezier splines.
 * HIGH-FIDELITY SVG: Animated API core replaces generic text headers.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowBigLeftDash,
  Activity,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCcw,
  BarChart2,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  useSharedValue,
  withDelay,
  withRepeat,
  Easing,
  useFrameCallback,
  withSequence,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
  Rect,
} from 'react-native-svg';
import { supabase } from '../../../lib/supabase/client';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { Database } from '../../../types/database/database.types';

// ─── THEME CONSTANTS (Liquid Neon) ───────────────────────────────────────────
const THEME = {
  obsidian: '#1F042E',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#32FF00',
  gold: '#FFD700',
  danger: '#FF3366',
  navy: '#050B14',
  lightPurple: '#6A5DF1',
};

const IS_WEB = Platform.OS === 'web';

const PRESET_COLORS: Record<string, string> = {
  ENV_MASTER: THEME.cyan,
  GEMINIAPI_KEY_1: THEME.pink,
  GEMINIAPI_KEY_2: THEME.green,
  GEMINIAPI_KEY_3: THEME.purple,
  GEMINIAPI_KEY_4: THEME.gold,
};

// Deterministic color assignment for unknown keys
const getColorForKey = (keyName: string) => {
  if (PRESET_COLORS[keyName]) return PRESET_COLORS[keyName];
  let hash = 0;
  for (let i = 0; i < keyName.length; i++)
    hash = keyName.charCodeAt(i) + ((hash << 5) - hash);
  const fallbackColors = [
    THEME.cyan,
    THEME.pink,
    THEME.green,
    THEME.purple,
    THEME.gold,
  ];
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

const strictInputStyle = {
  flex: 1,
  color: '#FFFFFF',
  fontSize: 14,
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(IS_WEB ? { outlineStyle: 'none' } : {}),
} as any;

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: NEBULA AMBIENT ENGINE (Parity with Settings)
// ══════════════════════════════════════════════════════════════════════════════

const CorePulse = React.memo(
  ({ delay, color, size, centerX, centerY }: any) => {
    const pulse = useSharedValue(0);
    useEffect(() => {
      pulse.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 8000, easing: Easing.out(Easing.cubic) }),
          -1,
          false,
        ),
      );
    }, [delay, pulse]);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(pulse.value, [0, 1], [0.8, 2.5]) }],
      opacity: interpolate(pulse.value, [0, 0.4, 1], [0.3, 0.1, 0]),
    }));
    return (
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            left: centerX - size / 2,
            top: centerY - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${color}15`,
            ...(IS_WEB ? ({ filter: 'blur(20px)' } as any) : {}),
          },
        ]}
      />
    );
  },
);
CorePulse.displayName = 'CorePulse';

const OrganicOrb = React.memo(
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

const AmbientArchitecture = React.memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  const coreX = width / 2;
  const coreY = isDesktop ? 160 : 120;
  const basePulseSize = isDesktop ? 300 : 200;

  return (
    // STRICT TOUCH ISOLATION: zIndex: -1 prevents background from eating touches
    <View
      style={[StyleSheet.absoluteFill, { zIndex: -1, elevation: -1 }]}
      pointerEvents="none"
    >
      <CorePulse
        delay={0}
        color={THEME.cyan}
        size={basePulseSize}
        centerX={coreX}
        centerY={coreY}
      />
      <CorePulse
        delay={2500}
        color={THEME.purple}
        size={basePulseSize}
        centerX={coreX}
        centerY={coreY}
      />
      <CorePulse
        delay={5000}
        color={THEME.pink}
        size={basePulseSize}
        centerX={coreX}
        centerY={coreY}
      />
      <OrganicOrb
        color={THEME.cyan}
        size={width * 0.5}
        initialX={width * 0.2}
        initialY={height * 0.3}
        speedX={0.2}
        speedY={0.15}
        phaseOffsetX={0}
        phaseOffsetY={Math.PI / 2}
        opacityBase={0.06}
      />
      <OrganicOrb
        color={THEME.purple}
        size={width * 0.6}
        initialX={width * 0.8}
        initialY={height * 0.6}
        speedX={0.15}
        speedY={0.25}
        phaseOffsetX={Math.PI}
        phaseOffsetY={0}
        opacityBase={0.08}
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: ANIMATED API SVG HEADER
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedApiIcon = React.memo(() => {
  const floatY = useSharedValue(0);
  const orbitRot = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    orbitRot.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRot.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
        },
        floatStyle,
      ]}
    >
      {/* Outer Orbiting Data Ring */}
      <Animated.View
        style={[{ position: 'absolute', width: 120, height: 120 }, orbitStyle]}
      >
        <Svg width="120" height="120" viewBox="0 0 120 120">
          <Circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={THEME.purple}
            strokeWidth="2"
            strokeDasharray="10 20"
            opacity="0.6"
          />
          <Circle cx="60" cy="10" r="4" fill={THEME.pink} />
          <Circle cx="110" cy="60" r="4" fill={THEME.cyan} />
        </Svg>
      </Animated.View>

      {/* Core API Shield */}
      <View style={{ width: 80, height: 80, position: 'absolute' }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Base Shield */}
          <Path
            d="M 50 10 L 90 25 L 90 60 C 90 80, 50 95, 50 95 C 50 95, 10 80, 10 60 L 10 25 Z"
            fill="rgba(0, 240, 255, 0.1)"
            stroke={THEME.cyan}
            strokeWidth="3"
          />
          {/* Inner API Text Box */}
          <Rect
            x="25"
            y="35"
            width="50"
            height="25"
            rx="4"
            fill={THEME.navy}
            stroke={THEME.gold}
            strokeWidth="2"
          />
          <Path
            d="M 35 42 L 40 42 L 40 52 M 35 47 L 40 47"
            stroke={THEME.gold}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M 45 42 L 50 42 C 53 42, 53 47, 50 47 L 45 47 L 45 52"
            fill="none"
            stroke={THEME.gold}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M 58 42 L 63 42 M 60.5 42 L 60.5 52 M 58 52 L 63 52"
            stroke={THEME.gold}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </Animated.View>
  );
});
AnimatedApiIcon.displayName = 'AnimatedApiIcon';

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS & DATA BUILDERS
// ══════════════════════════════════════════════════════════════════════════════
type SystemKey = Database['public']['Tables']['system_api_keys']['Row'];
type RawLog = {
  tokens_consumed: number;
  created_at: string;
  metadata: { api_key_name: string } | null;
};
type ChartDataPoint = {
  label: string;
  fullDate: string;
  total: number;
  breakdown: { keyName: string; tokens: number; color: string }[];
};

const buildDailyData = (logs: RawLog[]): ChartDataPoint[] => {
  const bins = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const datePrefix = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    bins.push({ label, fullDate: datePrefix, prefix: datePrefix });
  }
  return bins.map((bin) => {
    const binLogs = logs.filter((log) => log.created_at.startsWith(bin.prefix));
    const keyMap: Record<string, number> = {};
    let total = 0;
    binLogs.forEach((log) => {
      const keyName = log.metadata?.api_key_name || 'UNKNOWN_KEY';
      keyMap[keyName] = (keyMap[keyName] || 0) + (log.tokens_consumed || 0);
      total += log.tokens_consumed || 0;
    });
    const breakdown = Object.keys(keyMap).map((keyName) => ({
      keyName,
      tokens: keyMap[keyName],
      color: getColorForKey(keyName),
    }));
    return { label: bin.label, fullDate: bin.fullDate, total, breakdown };
  });
};

const buildMonthlyData = (logs: RawLog[]): ChartDataPoint[] => {
  const bins = [];
  const currentYear = new Date().getFullYear();
  const monthsArr = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  for (let i = 0; i < 12; i++) {
    const monthPrefix = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    bins.push({
      label: monthsArr[i],
      fullDate: `${monthsArr[i]} ${currentYear}`,
      prefix: monthPrefix,
    });
  }
  return bins.map((bin) => {
    const binLogs = logs.filter((log) => log.created_at.startsWith(bin.prefix));
    const keyMap: Record<string, number> = {};
    let total = 0;
    binLogs.forEach((log) => {
      const keyName = log.metadata?.api_key_name || 'UNKNOWN_KEY';
      keyMap[keyName] = (keyMap[keyName] || 0) + (log.tokens_consumed || 0);
      total += log.tokens_consumed || 0;
    });
    const breakdown = Object.keys(keyMap).map((keyName) => ({
      keyName,
      tokens: keyMap[keyName],
      color: getColorForKey(keyName),
    }));
    return { label: bin.label, fullDate: bin.fullDate, total, breakdown };
  });
};

// PERFECT BEZIER SMOOTHING
const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  const controlPoint = (
    current: any,
    previous: any,
    next: any,
    reverse: boolean,
  ) => {
    const p = previous || current;
    const n = next || current;
    const smoothing = 0.15; // Lower = tighter curves, higher = looser
    const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0);
    const length =
      Math.sqrt(Math.pow(n.x - p.x, 2) + Math.pow(n.y - p.y, 2)) * smoothing;
    return {
      x: current.x + Math.cos(angle) * length,
      y: current.y + Math.sin(angle) * length,
    };
  };
  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const cps = controlPoint(a[i - 1], a[i - 2], point, false);
    const cpe = controlPoint(point, a[i - 1], a[i + 1], true);
    return `${acc} C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
  }, '');
};

const getFillPath = (
  points: { x: number; y: number }[],
  pathStr: string,
  viewHeight: number,
  padY: number,
) => {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const bottomY = viewHeight - padY;
  return `${pathStr} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: UPGRADED MULTI-LINE VELOCITY CHART
// ══════════════════════════════════════════════════════════════════════════════
const SvgMultiLineChart = ({
  data,
  allUniqueKeys,
  hiddenKeys,
  selectedIndex,
  setSelectedIndex,
}: any) => {
  const VIEWBOX_W = 1000;
  const VIEWBOX_H = 280;
  const PADDING_Y = 40;
  const PADDING_X = 40;

  const activeKeysArray = Array.from(allUniqueKeys) as string[];
  const globalMaxVal = useMemo(
    () =>
      Math.max(
        ...data.flatMap((d: any) => d.breakdown.map((b: any) => b.tokens)),
        10,
      ),
    [data],
  );

  const lines = useMemo(() => {
    return activeKeysArray.map((keyName) => {
      const color = getColorForKey(keyName);
      const points = data.map((d: any, i: number) => {
        const b = d.breakdown.find((x: any) => x.keyName === keyName);
        const val = b ? b.tokens : 0;
        const x =
          PADDING_X + (i / (data.length - 1)) * (VIEWBOX_W - PADDING_X * 2);
        const y =
          VIEWBOX_H -
          PADDING_Y -
          (val / globalMaxVal) * (VIEWBOX_H - PADDING_Y * 2);
        return { x, y, val };
      });
      const pathStr = getSmoothPath(points);
      const fillStr = getFillPath(points, pathStr, VIEWBOX_H, PADDING_Y);
      return { keyName, color, points, pathStr, fillStr };
    });
  }, [data, activeKeysArray, globalMaxVal]);

  const activePoint = selectedIndex !== null ? data[selectedIndex] : null;

  // Animated Crosshair
  const crosshairOpacity = useSharedValue(0);
  const crosshairX = useSharedValue(VIEWBOX_W / 2);

  useEffect(() => {
    if (selectedIndex !== null) {
      crosshairOpacity.value = withTiming(1, { duration: 200 });
      const targetX =
        PADDING_X +
        (selectedIndex / (data.length - 1)) * (VIEWBOX_W - PADDING_X * 2);
      crosshairX.value = withSpring(targetX, { damping: 20, stiffness: 150 });
    } else {
      crosshairOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [selectedIndex, data]);

  const crosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
    transform: [{ translateX: crosshairX.value }],
  }));

  const tooltipOpacity = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
  }));

  return (
    <View className="relative w-full h-full">
      {/* Background Grid */}
      <View className="absolute inset-0 flex-col justify-between py-[12%] z-0">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="w-full h-px bg-white/[0.03]" />
        ))}
      </View>

      {/* SVG Layer (STATIC rendering to prevent Android crash) */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        style={{ zIndex: 10 }}
      >
        <Defs>
          {lines.map((line) => (
            <LinearGradient
              key={`grad-${line.keyName}`}
              id={`grad-${line.keyName}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0%" stopColor={line.color} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={line.color} stopOpacity="0" />
            </LinearGradient>
          ))}
        </Defs>

        {lines.map((line) => {
          if (hiddenKeys.has(line.keyName)) return null;
          return (
            <React.Fragment key={line.keyName}>
              <Path d={line.fillStr} fill={`url(#grad-${line.keyName})`} />
              <Path
                d={line.pathStr}
                stroke={line.color}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
              />
              {line.points.map((p: any, i: number) => (
                <Circle
                  key={`dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={THEME.obsidian}
                  stroke={line.color}
                  strokeWidth={2}
                />
              ))}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Animated HTML Crosshair Layer */}
      <Animated.View
        style={[
          crosshairStyle,
          {
            position: 'absolute',
            top: 10,
            bottom: 20,
            width: 2,
            backgroundColor: THEME.cyan,
            zIndex: 20,
          },
        ]}
      />

      {/* Touch Interceptor Grid */}
      <View className="absolute inset-0 z-30 flex-row">
        {data.map((point: any, idx: number) => {
          const isActive = selectedIndex === idx;
          return (
            <View key={idx} className="items-center justify-end flex-1 h-full">
              <Pressable
                className="absolute inset-0"
                {...(IS_WEB
                  ? {
                      onHoverIn: () => setSelectedIndex(idx),
                      onHoverOut: () => setSelectedIndex(null),
                    }
                  : {
                      onPressIn: () => setSelectedIndex(idx),
                      onPressOut: () => setSelectedIndex(null),
                    })}
              />
              <Text
                className={`mb-[-20px] text-[10px] uppercase tracking-wider transition-colors duration-200 ${isActive ? 'text-[#00F0FF] font-black' : 'text-white/30 font-bold'}`}
              >
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Persistent Floating Tooltip */}
      <Animated.View
        style={[
          tooltipOpacity,
          {
            position: 'absolute',
            top: -30,
            left: 0,
            right: 0,
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 50,
          },
        ]}
      >
        <View className="bg-[#020205]/95 border border-[#00F0FF]/30 rounded-2xl p-4 min-w-[220px] shadow-[0_10px_30px_rgba(0,240,255,0.15)] backdrop-blur-md">
          <Text className="text-[#00F0FF] text-[10px] font-black uppercase tracking-[2px] mb-3 text-center">
            {activePoint?.fullDate || ''}
          </Text>
          {activePoint?.breakdown.map((b: any, idx: number) => {
            if (hiddenKeys.has(b.keyName)) return null;
            return (
              <View
                key={idx}
                className="flex-row items-center justify-between mb-1.5 gap-x-6"
              >
                <View className="flex-row items-center gap-x-2">
                  <View
                    style={{ backgroundColor: b.color }}
                    className="w-2.5 h-2.5 rounded-full shadow-[0_0_5px]"
                  />
                  <Text className="font-mono text-[11px] text-white/80">
                    {b.keyName}
                  </Text>
                </View>
                <Text className="text-[12px] font-black tracking-widest text-white">
                  {b.tokens.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: UPGRADED LED CAPSULE BAR CHART (Mobile Optimized)
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedStackedBar = ({
  dataPoint,
  globalMaxMonthly,
  maxHeight,
  isSelected,
  onHoverIn,
  onHoverOut,
  hiddenKeys,
}: any) => {
  const visibleTotal = useMemo(
    () =>
      dataPoint.breakdown.reduce(
        (sum: number, b: any) =>
          hiddenKeys.has(b.keyName) ? sum : sum + b.tokens,
        0,
      ),
    [dataPoint, hiddenKeys],
  );

  const animatedWrapperStyle = useAnimatedStyle(() => {
    const targetHeight =
      globalMaxMonthly > 0 ? (visibleTotal / globalMaxMonthly) * maxHeight : 0;
    const finalHeight = Math.max(targetHeight, visibleTotal > 0 ? 12 : 0);
    return {
      height: withSpring(finalHeight, { damping: 18, stiffness: 100 }),
      opacity: withTiming(isSelected || !isSelected ? 1 : 0.5, {
        duration: 150,
      }),
    };
  });

  return (
    // Removed strict max-w-[40px] to allow flex spreading on mobile
    <View className="items-center justify-end flex-1 h-full mx-[2px] md:mx-[4px] relative">
      <Pressable
        {...(IS_WEB
          ? { onHoverIn, onHoverOut }
          : { onPressIn: onHoverIn, onPressOut: onHoverOut })}
        className="items-center justify-end w-full h-full"
      >
        {/* Ghost Track */}
        <View className="absolute bottom-0 w-full h-full bg-white/[0.02] rounded-[10px] border border-white/[0.04]" />

        {/* LED Stack Wrapper */}
        <Animated.View
          style={[
            animatedWrapperStyle,
            {
              width: '100%',
              borderRadius: 10,
              overflow: 'hidden',
              justifyContent: 'flex-end',
              zIndex: 10,
              padding: 2,
            },
          ]}
        >
          {dataPoint.breakdown.map((segment: any, idx: number) => {
            const isHidden = hiddenKeys.has(segment.keyName);
            const segmentHeightPct =
              isHidden || visibleTotal === 0
                ? 0
                : (segment.tokens / visibleTotal) * 100;
            return (
              <Animated.View
                key={idx}
                style={useAnimatedStyle(() => ({
                  height: withSpring(`${segmentHeightPct}%`, { damping: 18 }),
                  width: '100%',
                  backgroundColor: segment.color,
                  opacity: withTiming(isHidden ? 0 : 1),
                  borderRadius: 6,
                  marginBottom: 2,
                }))}
              />
            );
          })}
        </Animated.View>

        <Text
          className={`absolute bottom-[-20px] text-[8px] md:text-[10px] uppercase tracking-wider transition-colors duration-200 ${isSelected ? 'text-[#8A2BE2] font-black' : 'text-white/30 font-bold'}`}
          numberOfLines={1}
        >
          {dataPoint.label}
        </Text>
      </Pressable>

      {/* Floating Tooltip */}
      <Animated.View
        style={[
          useAnimatedStyle(() => ({
            opacity: withTiming(isSelected && visibleTotal > 0 ? 1 : 0),
          })),
          {
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: [{ translateX: '-50%' }],
            marginBottom: 12,
            zIndex: 50,
            pointerEvents: 'none',
          },
        ]}
      >
        <View className="bg-[#020205]/95 border border-[#8A2BE2]/40 rounded-2xl p-3 min-w-[180px] shadow-[0_10px_30px_rgba(138,43,226,0.15)] backdrop-blur-md">
          <Text className="text-[#8A2BE2] text-[9px] font-black uppercase tracking-[2px] mb-2 text-center">
            {dataPoint.fullDate}
          </Text>
          {dataPoint.breakdown.map((b: any, idx: number) => {
            if (hiddenKeys.has(b.keyName)) return null;
            return (
              <View
                key={idx}
                className="flex-row items-center justify-between mb-1 gap-x-4"
              >
                <View className="flex-row items-center gap-x-1.5">
                  <View
                    style={{ backgroundColor: b.color }}
                    className="w-2 h-2 rounded-full"
                  />
                  <Text className="font-mono text-[9px] text-white/80">
                    {b.keyName}
                  </Text>
                </View>
                <Text className="text-[10px] font-black tracking-widest text-white">
                  {b.tokens.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 5: MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ApiKeysDashboard() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  // Dynamically scale max height for the bar chart so it looks good on all screens
  const BAR_CHART_HEIGHT = isMobile ? 160 : 220;

  const [keys, setKeys] = useState<SystemKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dailyData, setDailyData] = useState<ChartDataPoint[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartDataPoint[]>([]);
  const [allUniqueKeys, setAllUniqueKeys] = useState<Set<string>>(new Set());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const [selectedDailyIdx, setSelectedDailyIdx] = useState<number | null>(null);
  const [selectedMonthlyIdx, setSelectedMonthlyIdx] = useState<number | null>(
    null,
  );

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: keyData, error: keyError } = await supabase
        .from('system_api_keys')
        .select('*')
        .order('created_at', { ascending: true });
      if (keyError) throw keyError;
      if (keyData) setKeys(keyData);

      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const { data: rawLogs, error: logsError } = await supabase
        .from('usage_logs')
        .select('tokens_consumed, created_at, metadata')
        .gte('created_at', startOfYear.toISOString());
      if (logsError) throw logsError;

      const typedLogs = (rawLogs || []) as RawLog[];
      setDailyData(buildDailyData(typedLogs));
      setMonthlyData(buildMonthlyData(typedLogs));

      const unique = new Set<string>();
      typedLogs.forEach((r) => {
        if (r.metadata?.api_key_name) unique.add(r.metadata.api_key_name);
      });
      setAllUniqueKeys(unique);
    } catch (err: any) {
      Alert.alert('Telemetry Sync Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeyVisibility = (keyName: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyName)) next.delete(keyName);
      else next.add(keyName);
      return next;
    });
  };

  const globalMaxMonthly = useMemo(
    () => Math.max(...monthlyData.map((d) => d.total), 10),
    [monthlyData],
  );

  const handleAddKey = async () => {
    if (!newKeyName || newKeyValue.length < 10)
      return Alert.alert('Protocol Error', 'Valid alias and API key required.');
    setIsAdding(true);
    try {
      const preview = `...${newKeyValue.slice(-6)}`;
      const { error } = await supabase.from('system_api_keys').insert({
        name: newKeyName,
        encrypted_key: newKeyValue,
        key_preview: preview,
        status: 'active',
        tokens_burned: 0,
      });
      if (error) throw error;
      setNewKeyName('');
      setNewKeyValue('');
      fetchDashboardData();
    } catch (err: any) {
      Alert.alert('Injection Failed', err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('system_api_keys')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setKeys(keys.filter((k) => k.id !== id));
    } catch (err: any) {
      Alert.alert('Deletion Failed', err.message);
    }
  };

  const ChartLegend = ({ chartData }: { chartData: ChartDataPoint[] }) => {
    const totals = useMemo(() => {
      const acc: Record<string, number> = {};
      allUniqueKeys.forEach((k) => (acc[k] = 0));
      chartData.forEach((d) => {
        d.breakdown.forEach((b) => {
          if (acc[b.keyName] !== undefined) acc[b.keyName] += b.tokens;
        });
      });
      return acc;
    }, [chartData, allUniqueKeys]);

    return (
      <View className="flex-row flex-wrap items-center justify-center gap-3 pt-6 mt-6 border-t border-white/5">
        {Array.from(allUniqueKeys).map((keyName) => {
          const isHidden = hiddenKeys.has(keyName);
          const keyColor = getColorForKey(keyName);
          const totalTokens = totals[keyName] || 0;
          if (totalTokens === 0) return null;
          return (
            <TouchableOpacity
              key={keyName}
              onPress={() => toggleKeyVisibility(keyName)}
              activeOpacity={0.7}
              className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${isHidden ? 'border-white/5 bg-transparent opacity-40 scale-95' : 'border-white/10 bg-white/5 shadow-[0_0_10px_rgba(0,0,0,0.5)] scale-100'}`}
            >
              <View
                style={{ backgroundColor: isHidden ? '#333' : keyColor }}
                className="w-2.5 h-2.5 rounded-full"
              />
              <Text
                className={`text-[10px] font-black uppercase tracking-widest ${isHidden ? 'text-white/30 line-through' : 'text-white'}`}
              >
                {keyName}{' '}
                <Text className="ml-1 font-mono tracking-normal text-white/50">
                  [{totalTokens.toLocaleString()}]
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#00000ffd]">
      {/* ─── RENDER AMBIENT ORB ENGINE BEHIND EVERYTHING ─── */}
      <AmbientArchitecture />

      {/* ─── FOREGROUND UI ─── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 1, elevation: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: isMobile ? 16 : 40,
            paddingTop: 24,
            paddingBottom: 150,
            flexGrow: 1,
            maxWidth: 1200,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          {/* ─── TOP NAVIGATION & ANIMATED HEADER ─── */}
          <FadeIn delay={100} className="w-full mb-10">
            <View className="relative flex-row items-center justify-center w-full h-16 mb-6">
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => router.replace('/admin')}
                className="absolute left-0 z-50 flex-row items-center py-2 gap-x-2 active:scale-95"
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <ArrowBigLeftDash size={20} color={THEME.cyan} />
              </TouchableOpacity>

              {/* Animated SVG Header */}
              <View className="items-center justify-center mt-10 pointer-events-none">
                <AnimatedApiIcon />
                <Text className="text-[10px] md:text-[12px] font-bold text-[#00F0FF]/60 uppercase tracking-[3px] mt-6 text-center">
                  {keys.length} FALLBACK NODES
                </Text>
              </View>

              {/* Refresh Button */}
              <TouchableOpacity
                onPress={fetchDashboardData}
                className="absolute right-0 z-50 items-center justify-center w-10 h-10 border rounded-2xl bg-[#00F0FF]/10 border-[#00F0FF]/20 active:scale-95"
              >
                <RefreshCcw size={16} color={THEME.cyan} />
              </TouchableOpacity>
            </View>
          </FadeIn>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={THEME.cyan}
              className="mt-20"
            />
          ) : (
            <>
              {/* ─── MODULE 1: DAILY VELOCITY CHART (MULTI-LINE) ─── */}
              <FadeIn delay={200}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px] overflow-visible mt-16">
                  <View className="flex-row items-center mb-10 gap-x-3 md:mb-12">
                    <Activity size={24} color={THEME.danger} />
                    <Text className="text-sm font-black tracking-widest text-white uppercase md:text-base">
                      Network Velocity (7D)
                    </Text>
                  </View>
                  <View className="relative z-20 h-64 pb-8">
                    {dailyData.length > 0 && (
                      <SvgMultiLineChart
                        data={dailyData}
                        allUniqueKeys={allUniqueKeys}
                        hiddenKeys={hiddenKeys}
                        selectedIndex={selectedDailyIdx}
                        setSelectedIndex={setSelectedDailyIdx}
                      />
                    )}
                  </View>
                  <ChartLegend chartData={dailyData} />
                </GlassCard>
              </FadeIn>

              {/* ─── MODULE 2: MONTHLY VOLUME CHART (LED BARS) ─── */}
              <FadeIn delay={300}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px] overflow-visible">
                  <View className="flex-row items-center mb-10 gap-x-3 md:mb-12">
                    <BarChart2 size={24} color={THEME.purple} />
                    <Text className="text-sm font-black tracking-widest text-white uppercase md:text-base">
                      Volume Aggregation (12M)
                    </Text>
                  </View>
                  {/* Dynamic Height applied to the chart container */}
                  <View
                    style={{ height: BAR_CHART_HEIGHT }}
                    className="relative z-20 flex-row items-end justify-between px-1 pb-10 md:px-4"
                  >
                    {monthlyData.map((point, idx) => (
                      <AnimatedStackedBar
                        key={`monthly-${idx}`}
                        dataPoint={point}
                        globalMaxMonthly={globalMaxMonthly}
                        maxHeight={BAR_CHART_HEIGHT - 40} // Prevent overflowing the container
                        isSelected={selectedMonthlyIdx === idx}
                        onHoverIn={() => setSelectedMonthlyIdx(idx)}
                        onHoverOut={() => setSelectedMonthlyIdx(null)}
                        hiddenKeys={hiddenKeys}
                      />
                    ))}
                  </View>
                  <ChartLegend chartData={monthlyData} />
                </GlassCard>
              </FadeIn>

              {/* ─── MODULE 3: SYSTEM FALLBACK KEYS VAULT ─── */}
              <FadeIn delay={400}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center mb-8 gap-x-3">
                    <ShieldCheck size={24} color={THEME.green} />
                    <Text className="text-sm font-black tracking-widest text-white uppercase md:text-base">
                      Cascading Fallback Matrix
                    </Text>
                  </View>

                  <View className="z-50 flex-col gap-4 mb-10 md:flex-row">
                    <View className="flex-1 h-14 border bg-black/40 border-white/10 rounded-[20px] px-5 focus-within:border-[#00F0FF] justify-center">
                      <TextInput
                        value={newKeyName}
                        onChangeText={setNewKeyName}
                        placeholder="Alias (e.g., Gemini-Backup-1)"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={strictInputStyle}
                        autoComplete="off"
                        autoCorrect={false}
                        spellCheck={false}
                      />
                    </View>
                    <View className="flex-[2] h-14 border bg-black/40 border-white/10 rounded-[20px] px-5 focus-within:border-[#00F0FF] justify-center">
                      <TextInput
                        value={newKeyValue}
                        onChangeText={setNewKeyValue}
                        keyboardType="visible-password"
                        placeholder="API Key (AIzaSy...)"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={strictInputStyle}
                        autoComplete="off"
                        autoCorrect={false}
                        spellCheck={false}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleAddKey}
                      disabled={isAdding}
                      className="h-14 px-8 items-center justify-center bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-[20px] active:scale-95"
                    >
                      {isAdding ? (
                        <ActivityIndicator size="small" color={THEME.cyan} />
                      ) : (
                        <View className="flex-row items-center gap-2">
                          <Plus size={18} color={THEME.cyan} />
                          <Text className="text-xs font-black text-[#00F0FF] uppercase tracking-widest md:hidden">
                            Add Key
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View className="gap-y-3">
                    {keys.length === 0 ? (
                      <View className="items-center justify-center py-10 border border-dashed border-white/10 rounded-[20px]">
                        <Text className="text-xs tracking-widest uppercase text-white/40">
                          No fallback keys registered.
                        </Text>
                      </View>
                    ) : (
                      keys.map((key) => {
                        const keyColor = getColorForKey(key.name);
                        return (
                          <View
                            key={key.id}
                            className="flex-col md:flex-row items-start md:items-center px-5 py-4 gap-y-3 md:gap-y-0 bg-black/40 border border-white/5 rounded-2xl md:rounded-[16px]"
                          >
                            <View className="flex-[2] flex-row items-center gap-x-3 w-full md:w-auto">
                              <View
                                className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]"
                                style={{
                                  backgroundColor: keyColor,
                                  shadowColor: keyColor,
                                }}
                              />
                              <Text className="text-sm font-black text-white md:text-xs">
                                {key.name}
                              </Text>
                            </View>
                            <Text className="flex-[2] text-xs font-mono text-white/50 w-full md:w-auto">
                              {key.key_preview}
                            </Text>
                            <View className="flex-row items-start justify-between flex-1 w-full md:items-end md:w-auto md:flex-col md:justify-center">
                              <Text className="text-[10px] text-white/30 tracking-[2px] uppercase md:hidden">
                                Tokens:
                              </Text>
                              <Text className="text-[12px] md:text-[10px] font-black text-[#00F0FF] tracking-widest">
                                {Number(
                                  key.tokens_burned || 0,
                                ).toLocaleString()}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDeleteKey(key.id)}
                              className="absolute items-end justify-center w-10 py-2 top-4 right-4 md:relative md:top-0 md:right-0"
                            >
                              <Trash2
                                size={16}
                                color={THEME.danger}
                                opacity={0.6}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                </GlassCard>
              </FadeIn>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
