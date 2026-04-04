/**
 * app/(dashboard)/history.tsx
 * Sovereign Archive & Vault Dashboard
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. NATIVE SVG ANIMATION: Exact translation of the user's custom Vault.svg.
 * 2. LIVE WAVEFORMS: Native View-based scaling for smooth audio bar pulses.
 * 3. STRUCTURAL SCROLLING: Strict flex-1 boundaries ensure cross-platform scroll.
 * 4. TIME-PARTITIONED DATA: Groups transcripts into "Today" and "History".
 */

import React, { useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHistoryData } from '../../hooks/queries/useHistoryData';
import { GlassCard } from '../../components/ui/GlassCard';
import { FadeIn } from '../../components/animations/FadeIn';
import { cn } from '../../lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon, Rect, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  Easing,
  withSequence,
} from 'react-native-reanimated';

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

// ─── EXACT VAULT SVG COMPONENT WITH ANIMATION ────────────────────────────────
const AnimatedVaultIcon = () => {
  const floatY = useSharedValue(0);

  // Waveform pulse values
  const wave1 = useSharedValue(16);
  const wave2 = useSharedValue(24);
  const wave3 = useSharedValue(12);

  useEffect(() => {
    // Smooth vertical floating of the entire graphic
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Audio waveform pulsing (staggered for organic look)
    wave1.value = withRepeat(
      withSequence(
        withTiming(26, { duration: 500 }),
        withTiming(12, { duration: 500 }),
      ),
      -1,
      true,
    );
    wave2.value = withRepeat(
      withSequence(
        withTiming(14, { duration: 700 }),
        withTiming(28, { duration: 700 }),
      ),
      -1,
      true,
    );
    wave3.value = withRepeat(
      withSequence(
        withTiming(22, { duration: 600 }),
        withTiming(10, { duration: 600 }),
      ),
      -1,
      true,
    );
  }, [floatY, wave1, wave2, wave3]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const w1Style = useAnimatedStyle(() => ({ height: wave1.value }));
  const w2Style = useAnimatedStyle(() => ({ height: wave2.value }));
  const w3Style = useAnimatedStyle(() => ({ height: wave3.value }));

  // Colors extracted exactly from your uploaded vault.svg
  const C = {
    navy: '#102B60',
    yellow: '#FFCD4D',
    purple: '#B294FF',
    teal: '#6EDCC9',
    lightBlue: '#88A9F3',
    white: '#FFFFFF',
  };

  return (
    <Animated.View
      style={[
        floatStyle,
        { width: 140, height: 140, alignSelf: 'center', marginBottom: 20 },
      ]}
    >
      {/* 1. BACKGROUND WINDOW */}
      <View style={{ position: 'absolute', top: 10, left: 10 }}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          {/* Main Window Body */}
          <Path
            d="M 15 25 Q 15 15 25 15 L 95 15 Q 105 15 105 25 L 105 85 Q 105 95 95 95 L 25 95 Q 15 95 15 85 Z"
            fill={C.white}
            stroke={C.navy}
            strokeWidth="6"
          />

          {/* Yellow Header Fill */}
          <Path
            d="M 18 25 Q 18 18 25 18 L 95 18 Q 102 18 102 25 L 102 32 L 18 32 Z"
            fill={C.yellow}
          />

          {/* Header Divider Line */}
          <Path d="M 15 32 L 105 32" stroke={C.navy} strokeWidth="6" />

          {/* Header OS Dots */}
          <Circle cx="26" cy="25" r="3" fill={C.white} />
          <Circle cx="37" cy="25" r="3" fill={C.white} />
          <Circle cx="48" cy="25" r="3" fill={C.white} />

          {/* Inner Purple Box */}
          <Rect x="25" y="42" width="70" height="42" rx="6" fill={C.purple} />
        </Svg>
      </View>

      {/* 2. ANIMATED AUDIO WAVEFORMS (Overlays the purple box) */}
      <View
        style={{
          position: 'absolute',
          top: 52,
          left: 45,
          width: 50,
          height: 42,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Animated.View
          style={[
            { width: 4, backgroundColor: C.white, borderRadius: 2 },
            w1Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 4, backgroundColor: C.white, borderRadius: 2 },
            w2Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 4, backgroundColor: C.white, borderRadius: 2 },
            w3Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 4, backgroundColor: C.white, borderRadius: 2 },
            w1Style,
          ]}
        />
        <Animated.View
          style={[
            { width: 4, backgroundColor: C.white, borderRadius: 2 },
            w2Style,
          ]}
        />
      </View>

      {/* 3. FOREGROUND MICROCHIP BUBBLE */}
      <View style={{ position: 'absolute', top: 10, left: 10 }}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          {/* Speech Bubble Tail (Using exact polygon coordinates to match your image) */}
          <Path
            d="M 58 72 L 40 52 L 48 78 Z"
            fill={C.white}
            stroke={C.navy}
            strokeWidth="6"
            strokeLinejoin="round"
          />

          {/* Main Speech Bubble Circle */}
          <Circle
            cx="75"
            cy="85"
            r="26"
            fill={C.white}
            stroke={C.navy}
            strokeWidth="6"
          />

          {/* Seam Cover (Hides the line where the tail meets the circle) */}
          <Path d="M 56 68 L 52 76" stroke={C.white} strokeWidth="8" />

          {/* Microchip Under-Pins (Light Blue) */}
          <Path
            d="M 60 78 L 90 78 M 60 92 L 90 92"
            stroke={C.lightBlue}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Path
            d="M 68 70 L 68 100 M 82 70 L 82 100"
            stroke={C.lightBlue}
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Main Microchip Square (Teal) */}
          <Rect
            x="63"
            y="73"
            width="24"
            height="24"
            rx="3"
            fill={C.teal}
            stroke={C.navy}
            strokeWidth="5"
          />

          {/* Microchip Center Dot */}
          <Circle cx="75" cy="85" r="3" fill={C.white} />
        </Svg>
      </View>
    </Animated.View>
  );
};

// ─── DATA INTERFACES ─────────────────────────────────────────────────────────
interface HistoryItem {
  id: string | number;
  status:
    | 'queued'
    | 'downloading'
    | 'transcribing'
    | 'ai_processing'
    | 'completed'
    | 'failed';
  created_at: string;
  video_url?: string;
  title?: string | null;
}

// ─── MAIN SCREEN COMPONENT ───────────────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  const { data: history, isLoading, error, refetch } = useHistoryData();

  // Partition data into Today vs Earlier
  const groupedHistory = useMemo(() => {
    const today: HistoryItem[] = [];
    const earlier: HistoryItem[] = [];

    if (!history) return { today, earlier };

    const now = new Date();
    (history as any[]).forEach((item: HistoryItem) => {
      const d = new Date(item.created_at);
      if (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        today.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, earlier };
  }, [history]);

  // ─── ERROR STATE ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#020205] items-center justify-center p-10">
        <GlassCard
          glowColor="pink"
          className="p-8 items-center bg-white/[0.01]"
        >
          <Text className="text-rose-500 font-black text-[10px] tracking-[5px] uppercase mb-4">
            Uplink Error
          </Text>
          <Text className="mb-8 text-xs leading-relaxed text-center text-white/60">
            {error instanceof Error ? error.message : 'Unknown Fault Detected.'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="px-8 py-3 transition-colors border rounded-full border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30"
          >
            <Text className="text-rose-400 font-bold text-[10px] tracking-widest uppercase">
              Retry Connection
            </Text>
          </TouchableOpacity>
        </GlassCard>
      </SafeAreaView>
    );
  }

  // ─── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#020205]">
      {/* AMBIENT BACKGROUND */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#00F0FF" />
        <NeuralOrb delay={2500} color="#8A2BE2" />
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
          {/* HEADER SECTION WITH NEW ANIMATED VAULT */}
          <FadeIn>
            <View className="items-center w-full max-w-2xl mb-10 md:mb-16">
              <View className="px-5 py-1.5 mb-8 border rounded-full bg-blue-500/10 border-blue-500/20">
                <Text className="text-[9px] md:text-[10px] font-black tracking-[4px] text-blue-400 uppercase">
                  SECURE STORAGE
                </Text>
              </View>

              {/* THE NEW ICON */}
              <AnimatedVaultIcon />

              <Text
                className={cn(
                  'mt-2 font-black text-white tracking-tighter uppercase text-center leading-none',
                  isMobile ? 'text-4xl' : 'text-6xl',
                )}
              >
                Archive <Text className="text-blue-400">Vault</Text>
              </Text>
              <View className="h-[2px] w-20 bg-blue-500 mt-6 md:mt-8 rounded-full shadow-[0_0_20px_#3B82F6]" />
            </View>
          </FadeIn>

          {/* VAULT CONTENT */}
          <View className="w-full max-w-2xl px-2">
            {isLoading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color="#00F0FF" />
                <Text className="mt-6 text-[10px] font-bold tracking-[6px] text-blue-400 uppercase">
                  Decrypting Vault...
                </Text>
              </View>
            ) : (
              <>
                {/* TODAY'S PAYLOADS */}
                {groupedHistory.today.length > 0 && (
                  <FadeIn delay={100}>
                    <View className="mb-10">
                      <Text className="text-white/30 font-bold text-[10px] uppercase tracking-[5px] mb-4 ml-4">
                        Today
                      </Text>
                      <View className="gap-y-4">
                        {groupedHistory.today.map((item: HistoryItem) => (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() =>
                              router.push(`/video/${item.id}` as any)
                            }
                            activeOpacity={0.8}
                          >
                            <GlassCard
                              className="flex-row items-center p-6 bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] transition-colors rounded-3xl"
                              glowColor="cyan"
                            >
                              <View className="flex-1">
                                <Text className="mb-2 text-base font-bold tracking-wide text-white uppercase">
                                  TRANSCRIPT ID {String(item.id).slice(0, 8)}
                                </Text>
                                <View className="flex-row items-center">
                                  <View
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full mr-2.5',
                                      item.status === 'completed'
                                        ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                                        : item.status === 'failed'
                                          ? 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'
                                          : 'bg-blue-400 shadow-[0_0_8px_#60A5FA]',
                                    )}
                                  />
                                  <Text className="text-white/40 text-[9px] font-mono uppercase tracking-widest">
                                    Status: {item.status.replace('_', ' ')}
                                  </Text>
                                </View>
                              </View>
                              <Text className="pl-4 text-2xl text-blue-400 opacity-50">
                                ›
                              </Text>
                            </GlassCard>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </FadeIn>
                )}

                {/* HISTORICAL PAYLOADS */}
                <FadeIn delay={200}>
                  <View className="mb-10">
                    <Text className="text-white/30 font-bold text-[10px] uppercase tracking-[5px] mb-4 ml-4">
                      HISTORY
                    </Text>
                    {groupedHistory.earlier.length === 0 ? (
                      <View className="items-center justify-center p-8 border border-white/5 rounded-3xl bg-white/[0.02]">
                        <Text className="text-white/20 text-[10px] font-mono uppercase tracking-widest italic">
                          No archived payloads found.
                        </Text>
                      </View>
                    ) : (
                      <View className="gap-y-4">
                        {groupedHistory.earlier.map((item: HistoryItem) => (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() =>
                              router.push(`/video/${item.id}` as any)
                            }
                            activeOpacity={0.8}
                          >
                            <GlassCard
                              className="flex-row items-center p-6 bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03] transition-colors rounded-3xl"
                              glowColor="purple"
                            >
                              <View className="flex-1">
                                <Text className="text-sm font-bold tracking-wide uppercase text-white/90">
                                  Engine Logs{' '}
                                  {typeof item.id === 'string'
                                    ? item.id.slice(0, 8)
                                    : String(item.id).slice(0, 8)}
                                </Text>
                                <View className="flex-row items-center mt-2">
                                  <View
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full mr-2.5',
                                      item.status === 'completed'
                                        ? 'bg-emerald-400 opacity-50'
                                        : item.status === 'failed'
                                          ? 'bg-rose-500 opacity-50'
                                          : 'bg-blue-400 opacity-50',
                                    )}
                                  />
                                  <Text className="text-white/30 text-[9px] font-mono uppercase tracking-widest">
                                    {format(
                                      new Date(item.created_at),
                                      'yyyy-MM-dd',
                                    )}
                                  </Text>
                                </View>
                              </View>
                              <Text className="pl-4 text-2xl text-purple-400 opacity-40">
                                ›
                              </Text>
                            </GlassCard>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </FadeIn>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
