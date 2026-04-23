/**
 * app/(dashboard)/admin/index.tsx
 * VeraxAI - ADMIN Command Center
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * PROP SAFETY: Strict JS ternary logic for responsive sizing.
 * ZERO-DROP TOUCH: keyboardShouldPersistTaps="always" + delayPressIn={0} eradicates APK tap drops
 * Real-Time Stream locked into a strict w-1/3, flex-1, w-24 grid for Web
 * ADAPTIVE COLLAPSE: Tables switch from horizontal grids to clean vertical stacks on APK, WEB, MOBILE
 * DOM ISOLATION: Ambient background is a strict sibling node to prevent elevation overlaps
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
  TextInput,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
  FadeInDown,
  Easing,
  useFrameCallback,
} from 'react-native-reanimated';
import {
  Users,
  Lock,
  Layers,
  Coins,
  Server,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Activity,
  Cpu,
  History,
  RefreshCcw,
  Zap,
  ArrowUpRight,
  KeyRound,
  ArrowBigLeftDash,
  ExternalLink,
  Receipt,
  Landmark,
  Clock,
} from 'lucide-react-native';

// ─── STRICT DATABASE DEPENDENCIES ───
import { supabase } from '../../../lib/supabase/client';
import { Database } from '../../../types/database/database.types';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── STRICT SUPABASE TYPING (Restored) ───
type UserRole = Database['public']['Enums']['user_role'];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  tokens_balance: number;
  status: string | null;
  banned_until: string | null;
  created_at: string;
  custom_api_key: string | null;
}

type DBTypes = Database;

// ─── STRICT THEME ENFORCEMENT (Liquid Neon) ───
const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  danger: '#FF007F',
  success: '#32FF00',
  warning: '#F59E0B',
  purple: '#8A2BE2',
  slate: '#94a3b8',
  pink: '#FF007F',
};

const IS_WEB = Platform.OS === 'web';

const strictInputStyle = {
  flex: 1,
  height: '100%',
  color: '#FFFFFF',
  fontSize: 12,
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(IS_WEB ? { outlineStyle: 'none' } : {}),
} as any;

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT ENGINE (Wandering Core + Nebula)
// ══════════════════════════════════════════════════════════════════════════════

const SingleRipple = React.memo(({ color, delay, duration, maxSize }: any) => {
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
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, maxSize]),
    height: interpolate(progress.value, [0, 1], [0, maxSize]),
    borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
    opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 0.15, 0.02, 0]),
    borderWidth: interpolate(progress.value, [0, 1], [60, 20]),
  }));
  return (
    <Animated.View
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

// ─── PART B: THE GLIDING CORE ───
interface GlidingEmitterProps {
  coreSize: number;
  color: string;
  maxWaveSize: number;
  waveCount: number;
  baseDuration: number;
}

const WanderingCore = memo(
  ({
    coreSize,
    color,
    maxWaveSize,
    waveCount,
    baseDuration,
  }: GlidingEmitterProps) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);
    const stagger = baseDuration / waveCount;

    // 120fps UI-Thread Logic for ultra-smooth gliding
    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 3000;
    });

    // Moves the core in a sleek infinity loop
    const animatedPosition = useAnimatedStyle(() => {
      const xOffset = Math.sin(time.value * 0.4) * (width * 0.3);
      const yOffset = Math.cos(time.value * 0.3) * (height * 0.2);

      return {
        transform: [
          { translateX: width / 2 + xOffset },
          { translateY: height / 2 + yOffset },
        ],
      };
    });

    const corePulse = useSharedValue(0.4);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, []);

    const coreStyle = useAnimatedStyle(() => ({
      opacity: interpolate(corePulse.value, [0.4, 1], [0.4, 1]),
      transform: [{ scale: interpolate(corePulse.value, [0.4, 1], [0.5, 1]) }],
    }));

    return (
      <Animated.View
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
            delay={index * stagger}
            duration={baseDuration}
            maxSize={maxWaveSize}
          />
        ))}

        <Animated.View
          style={[
            coreStyle,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowRadius: 15,
              shadowOpacity: 1,
              shadowOffset: { width: 0, height: 0 },
              ...(IS_WEB ? ({ boxShadow: `0 0 20px ${color}` } as any) : {}),
            },
          ]}
        />
      </Animated.View>
    );
  },
);
WanderingCore.displayName = 'WanderingCore';

// ─── PART C: THE DEEP NEBULA ───
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

// ─── MASTER AMBIENT CONTROLLER ───
const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  const massiveWaveRadius = isDesktop ? width * 0.4 : height * 1.0;

  return (
    // CRITICAL: pointerEvents="none" guarantees zero touch overlap
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* LAYER 1: Deep Nebula Background (From Settings - Soft and elegant) */}
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

      {/* LAYER 2: The Wandering Core with Solid Glowing Waves */}
      <WanderingCore
        coreSize={14}
        color="#02AABC" // Cyan Core
        maxWaveSize={massiveWaveRadius}
        waveCount={4} // 4 simultaneous pulses fading as they grow
        baseDuration={12000} // 12 seconds for a wave to fully expand
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: DATABASE TYPES & INTERFACES
// ══════════════════════════════════════════════════════════════════════════════
type Profile = DBTypes['public']['Tables']['profiles']['Row'];
type Video = DBTypes['public']['Tables']['videos']['Row'];
type UsageLog = DBTypes['public']['Tables']['usage_logs']['Row'];
type AIInsight = DBTypes['public']['Tables']['ai_insights']['Row'];
type SystemApiKey = DBTypes['public']['Tables']['system_api_keys']['Row'];

type EnrichedLog = UsageLog & {
  ai_model_name?: string | null;
  actual_tokens_burned?: number | null;
};

interface TelemetrySnapshot {
  users: { total: number; premium: number; admin: number; liability: number };
  infra: {
    failedJobs: number;
    tokensBurned: number;
    avgTokensPerJob: number;
    latencyMs: string;
  };
  keys: { count: number; totalBurn: number };
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: MASTER DASHBOARD CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminCommandCenter() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  const [refreshing, setRefreshing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'OPERATIONAL' | 'DEGRADED'>(
    'OPERATIONAL',
  );
  const [expandedAlerts, setExpandedAlerts] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    users: { total: 0, premium: 0, admin: 0, liability: 0 },
    infra: {
      failedJobs: 0,
      tokensBurned: 0,
      avgTokensPerJob: 0,
      latencyMs: '0ms',
    },
    keys: { count: 0, totalBurn: 0 },
  });

  const [registryPreview, setRegistryPreview] = useState<Profile[]>([]);
  const [failures, setFailures] = useState<
    Pick<Video, 'id' | 'title' | 'error_message' | 'updated_at'>[]
  >([]);
  const [liveStream, setLiveStream] = useState<EnrichedLog[]>([]);

  // Advanced SaaS Forecast Inputs
  const [inputs, setInputs] = useState({
    mau: '1000',
    subPrice: '29',
    avgMins: '60',
    storeFee: '15',
    taxRate: '20',
  });

  const synchronizeTelemetry = useCallback(async () => {
    const syncStartTime = Date.now();
    try {
      const [
        { data: profiles },
        { data: videos },
        { data: insights },
        { data: logs },
        { data: keys },
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase
          .from('videos')
          .select('id, status, title, error_message, updated_at'),
        supabase
          .from('ai_insights')
          .select('tokens_used, ai_model, video_id, created_at'),
        supabase
          .from('usage_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('system_api_keys').select('tokens_burned'),
      ]);

      const dbLatency = Date.now() - syncStartTime;

      const safeProfiles = (profiles as Profile[]) || [];
      const safeVideos = (videos as Video[]) || [];
      const safeInsights = (insights as AIInsight[]) || [];
      const safeLogs = (logs as UsageLog[]) || [];
      const safeKeys = (keys as Pick<SystemApiKey, 'tokens_burned'>[]) || [];

      const activeLiability = safeProfiles.reduce(
        (acc, curr) => acc + (curr.tokens_balance || 0),
        0,
      );
      const realTokensBurned = safeInsights.reduce(
        (acc, curr) => acc + (curr.tokens_used || 0),
        0,
      );
      const avgTokens =
        safeInsights.length > 0
          ? Math.round(realTokensBurned / safeInsights.length)
          : 0;
      const failedJobs = safeVideos.filter((v) => v.status === 'failed');
      const totalKeyBurn = safeKeys.reduce(
        (acc, curr) => acc + (curr.tokens_burned || 0),
        0,
      );

      setTelemetry({
        users: {
          total: safeProfiles.length,
          premium: safeProfiles.filter((p) => p.role === 'premium').length,
          admin: safeProfiles.filter((p) => p.role === 'admin').length,
          liability: activeLiability,
        },
        infra: {
          failedJobs: failedJobs.length,
          tokensBurned: realTokensBurned,
          avgTokensPerJob: avgTokens,
          latencyMs: `${dbLatency}ms`,
        },
        keys: { count: safeKeys.length, totalBurn: totalKeyBurn },
      });

      setFailures(
        failedJobs.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      );
      setRegistryPreview(safeProfiles.slice(0, 5));

      setLiveStream(
        safeLogs.map((log) => {
          const matchingInsight = safeInsights.find(
            (i) => i.video_id === log.video_id,
          );
          return {
            ...log,
            ai_model_name:
              log.ai_model || matchingInsight?.ai_model || 'System',
            actual_tokens_burned:
              log.tokens_consumed || matchingInsight?.tokens_used || 0,
          };
        }),
      );

      setHealthStatus(dbLatency > 2000 ? 'DEGRADED' : 'OPERATIONAL');
    } catch (err) {
      console.error('[TELEMETRY FAULT]:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    synchronizeTelemetry();
    const channel = supabase
      .channel(`admin_kernel_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        synchronizeTelemetry,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'videos' },
        synchronizeTelemetry,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'usage_logs' },
        synchronizeTelemetry,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [synchronizeTelemetry]);

  const saasFinancials = useMemo(() => {
    const mau = parseFloat(inputs.mau) || 0;
    const price = parseFloat(inputs.subPrice) || 0;
    const mins = parseFloat(inputs.avgMins) || 0;
    const feePct = parseFloat(inputs.storeFee) || 0;
    const taxPct = parseFloat(inputs.taxRate) || 0;

    const grossMRR = mau * price;
    const storeFeeDeduction = grossMRR * (feePct / 100);
    const taxDeduction = grossMRR * (taxPct / 100);
    const netAfterPlatforms = grossMRR - storeFeeDeduction - taxDeduction;
    const estimatedApiCostPerUser =
      ((telemetry.infra.avgTokensPerJob * (mins / 10)) / 1000000) * 0.5;
    const totalApiBurnCost = mau * estimatedApiCostPerUser;

    const netProfit = netAfterPlatforms - totalApiBurnCost;
    const margin = grossMRR > 0 ? (netProfit / grossMRR) * 100 : 0;

    return {
      gross: grossMRR,
      storeCut: storeFeeDeduction,
      taxCut: taxDeduction,
      apiCost: totalApiBurnCost,
      net: netProfit,
      margin: margin,
    };
  }, [inputs, telemetry.infra.avgTokensPerJob]);

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <View style={{ flex: 1, backgroundColor: THEME.obsidian }}>
      {/* ── STRICT TOUCH ISOLATION (Ambient Background) ── */}
      <View
        style={[StyleSheet.absoluteFill, { zIndex: -1, elevation: -1 }]}
        pointerEvents="none"
      >
        <AmbientArchitecture />
      </View>

      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'bottom', 'left', 'right']}
        pointerEvents="box-none"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            overScrollMode="never" // Prevents Android overscroll touch hijacking
            keyboardShouldPersistTaps="always" // CRITICAL FIX: Forces instant touch registration for all children
            contentContainerStyle={{
              paddingHorizontal: isMobile ? 16 : 40,
              paddingTop: 24,
              paddingBottom: 150,
              flexGrow: 1,
              maxWidth: 1280,
              alignSelf: 'center',
              width: '100%',
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  synchronizeTelemetry();
                }}
                tintColor={THEME.cyan}
              />
            }
          >
            {/* ════════ 1. COMMAND HEADER ════════ */}
            <FadeIn delay={100} className="z-50 flex-col mb-12">
              <TouchableOpacity
                onPress={() => router.replace('/')}
                delayPressIn={0} // Instantly register tap
                className="flex-row items-center self-start mb-6 gap-x-3"
                activeOpacity={0.7}
              >
                <ArrowBigLeftDash size={22} color={THEME.cyan} />
              </TouchableOpacity>

              <View className="flex-row items-start justify-between w-full">
                <View>
                  <Text className="text-3xl font-black tracking-tighter text-white uppercase md:text-4xl">
                    Admin Core
                  </Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <RefreshCcw size={16} color={THEME.cyan} />
                    <Text className="text-[9px] md:text-[10px] font-black tracking-[4px] text-white/50 uppercase">
                      Live Telemetry
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    alignSelf: 'flex-start',
                    shadowColor:
                      healthStatus === 'OPERATIONAL'
                        ? THEME.success
                        : THEME.warning,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 12,
                    elevation: 4,
                    ...(IS_WEB
                      ? ({
                          boxShadow: `0 4px 10px ${healthStatus === 'OPERATIONAL' ? THEME.success : THEME.warning}60`,
                        } as any)
                      : {}),
                  }}
                  className={cn(
                    'flex-row items-center px-4 py-2.5 border rounded-full',
                    healthStatus === 'OPERATIONAL'
                      ? 'bg-[#32FF00]/10 border-[#17fcb8]/40'
                      : 'bg-[#01111f]/10 border-[#F59E0B]/40',
                  )}
                >
                  <Activity
                    size={12}
                    color={
                      healthStatus === 'OPERATIONAL'
                        ? THEME.success
                        : THEME.warning
                    }
                  />
                  <Text
                    className={cn(
                      'ml-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest',
                      healthStatus === 'OPERATIONAL'
                        ? 'text-[#00ffd5]'
                        : 'text-[#F59E0B]',
                    )}
                  >
                    {healthStatus}
                  </Text>
                </View>
              </View>
            </FadeIn>

            {/* ════════ 2. DIAGNOSTICS BAR ════════ */}
            <FadeIn delay={200}>
              <GlassCard className="flex-col gap-4 p-5 mb-10 border md:p-6 md:flex-row md:items-center md:justify-between bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                <View className="flex-row items-center gap-4">
                  <View className="items-center justify-center w-10 h-10 border rounded-xl bg-blue-500/10 border-blue-500/20">
                    <Server size={18} color="#3B82F6" />
                  </View>
                  <View>
                    <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                      Ping Latency
                    </Text>
                    <Text className="text-base font-bold text-white/90">
                      {telemetry.infra.latencyMs}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-4">
                  <View className="items-center justify-center w-10 h-10 border rounded-xl bg-[#32FF00]/10 border-[#32FF00]/20">
                    <Lock size={18} color={THEME.success} />
                  </View>
                  <View>
                    <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                      Security
                    </Text>
                    <Text className="text-base font-bold text-[#32FF00]">
                      Strict-v3 SSL
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-4">
                  <View className="items-center justify-center w-10 h-10 border rounded-xl bg-amber-500/10 border-amber-500/20">
                    <ShieldCheck size={18} color={THEME.warning} />
                  </View>
                  <View>
                    <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                      Health
                    </Text>
                    <Text className="text-base font-bold text-[#F59E0B]">
                      {healthStatus}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </FadeIn>

            {/* ════════ 3. SYSTEM SNAPSHOT ════════ */}
            <View className="flex-row items-center gap-3 mb-6">
              <Layers size={14} color="#fff" />
              <Text className="text-[10px] md:text-[11px] font-black text-white tracking-[3px] uppercase">
                Manager Panel
              </Text>
            </View>

            <View className="flex-col gap-4 mb-12 lg:flex-row">
              <View className="w-full lg:flex-1">
                <GlassCard className="p-0 border overflow-hidden bg-white/[0.015] border-white/5 rounded-3xl h-36">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => router.push('/admin/users')}
                    className="flex-col justify-between flex-1 p-6 hover:bg-white/[0.03] transition-colors"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="items-center justify-center w-10 h-10 border rounded-xl bg-[#00F0FF]/10 border-[#00F0FF]/20">
                        <Users size={18} color={THEME.cyan} />
                      </View>
                      <ArrowUpRight
                        size={18}
                        color={THEME.cyan}
                        opacity={0.5}
                      />
                    </View>
                    <View>
                      <Text className="text-4xl font-black text-white">
                        {telemetry.users.total}
                      </Text>
                      <Text className="mt-1 text-[9px] font-black tracking-widest text-white/40 uppercase">
                        Total Accounts
                      </Text>
                    </View>
                  </TouchableOpacity>
                </GlassCard>
              </View>

              <View className="w-full lg:flex-1">
                <GlassCard className="flex-col justify-between p-6 bg-white/[0.015] border-white/5 rounded-3xl h-36">
                  <View className="items-center justify-center w-10 h-10 border rounded-xl bg-[#8A2BE2]/10 border-[#8A2BE2]/20">
                    <TrendingUp size={18} color={THEME.purple} />
                  </View>
                  <View>
                    <Text className="text-4xl font-black text-[#8A2BE2]">
                      {telemetry.users.premium}
                    </Text>
                    <Text className="mt-1 text-[9px] font-black tracking-widest text-white/40 uppercase">
                      Premium Subs
                    </Text>
                  </View>
                </GlassCard>
              </View>

              <View className="w-full lg:flex-1">
                <GlassCard className="flex-col p-6 bg-white/[0.015] border-white/5 rounded-3xl min-h-[144px]">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="items-center justify-center w-10 h-10 border rounded-xl bg-[#FF007F]/10 border-[#FF007F]/20">
                      <AlertTriangle
                        size={18}
                        color={
                          telemetry.infra.failedJobs > 0
                            ? THEME.danger
                            : '#64748b'
                        }
                      />
                    </View>
                    {telemetry.infra.failedJobs > 0 && (
                      <TouchableOpacity
                        delayPressIn={0}
                        onPress={() => {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                          setExpandedAlerts(!expandedAlerts);
                        }}
                        className="px-3 py-1.5 border rounded-full bg-white/5 border-white/10 active:scale-95"
                      >
                        <Text className="text-[9px] font-black text-white uppercase tracking-widest">
                          {expandedAlerts ? 'HIDE' : 'LOGS'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {expandedAlerts ? (
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      className="max-h-[80px] mt-2"
                    >
                      {failures.map((v) => (
                        <View
                          key={v.id}
                          className="py-2 border-b border-white/5"
                        >
                          <Text
                            className="text-[10px] font-bold text-[#FF007F]"
                            numberOfLines={1}
                          >
                            {v.title || 'Unknown Asset'}
                          </Text>
                          <Text className="text-[8px] text-white/40 mt-1">
                            {v.error_message || 'Pipeline Error'}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View className="mt-auto">
                      <Text
                        className={cn(
                          'text-4xl font-black',
                          telemetry.infra.failedJobs > 0
                            ? 'text-[#FF007F]'
                            : 'text-white/80',
                        )}
                      >
                        {telemetry.infra.failedJobs}
                      </Text>
                      <Text className="mt-1 text-[9px] font-black tracking-widest text-white/40 uppercase">
                        System Failures
                      </Text>
                    </View>
                  )}
                </GlassCard>
              </View>
            </View>

            {/* ════════ 4. SYSTEM API VAULT (ROUTER) ════════ */}
            <View className="flex-row items-center gap-3 mb-6">
              <KeyRound size={14} color="#fff" />
              <Text className="text-[10px] md:text-[11px] font-black text-white tracking-[3px] uppercase">
                API Gateway Configuration
              </Text>
            </View>

            <GlassCard className="flex-col items-center justify-between p-6 mb-12 border gap-y-6 md:gap-y-0 md:flex-row md:p-8 bg-white/[0.015] border-white/5 rounded-3xl">
              <View>
                <Text className="mb-2 text-xl font-black tracking-widest text-white uppercase">
                  Secure Key Vault
                </Text>
                <Text className="text-xs text-white/40 max-w-[300px] leading-relaxed">
                  Manage cascading API fallbacks, view dedicated token burn
                  charts, and monitor system integrations.
                </Text>
                <View className="flex-row items-center gap-4 mt-4">
                  <View>
                    <Text className="text-[9px] uppercase tracking-widest text-white/30">
                      Active Nodes
                    </Text>
                    <Text className="text-sm font-black text-[#00F0FF]">
                      {telemetry.keys.count}
                    </Text>
                  </View>
                  <View className="w-[1px] h-6 bg-white/10" />
                  <View>
                    <Text className="text-[9px] uppercase tracking-widest text-white/30">
                      Vault Tokens Burned
                    </Text>
                    <Text className="text-sm font-black text-[#00F0FF]">
                      {telemetry.keys.totalBurn.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/admin/keys')}
                delayPressIn={0}
                className="w-full md:w-auto flex-row items-center justify-center px-8 py-4 bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-2xl active:scale-95 transition-transform"
              >
                <Text className="text-xs font-black text-[#00F0FF] uppercase tracking-widest mr-3">
                  Enter Vault
                </Text>
                <ExternalLink size={16} color={THEME.cyan} />
              </TouchableOpacity>
            </GlassCard>

            {/* ════════ 5. SAAS FORECASTER 2.0 ════════ */}
            <View className="flex-row items-center gap-3 mb-6">
              <Coins size={14} color="#facc15" />
              <Text className="text-[10px] md:text-[11px] font-black text-white tracking-[3px] uppercase">
                Economic Engine & Real-Time Forecaster
              </Text>
            </View>

            <GlassCard className="p-6 md:p-8 bg-white/[0.015] border-white/5 rounded-3xl mb-12">
              <View className="flex-col lg:flex-row">
                {/* ─── INPUTS ─── */}
                <View className="flex-1 pb-8 mb-8 border-b lg:border-b-0 lg:mb-0 lg:border-r border-white/5 lg:pr-8 lg:pb-0">
                  <View className="flex-col mb-4 md:flex-row md:gap-4">
                    <View className="w-full mb-4 md:flex-1 md:mb-0">
                      <Text className="mb-2 text-[9px] font-black text-white/50 uppercase tracking-widest">
                        Active Users (MAU)
                      </Text>
                      <View className="justify-center h-12 px-4 border bg-black/40 border-white/10 rounded-xl">
                        <TextInput
                          keyboardType="numeric"
                          value={inputs.mau}
                          onChangeText={(v) =>
                            setInputs((p) => ({ ...p, mau: v }))
                          }
                          style={strictInputStyle}
                        />
                      </View>
                    </View>
                    <View className="w-full md:flex-1">
                      <Text className="mb-2 text-[9px] font-black text-white/50 uppercase tracking-widest">
                        Sub Price ($)
                      </Text>
                      <View className="justify-center h-12 px-4 border bg-black/40 border-white/10 rounded-xl">
                        <TextInput
                          keyboardType="numeric"
                          value={inputs.subPrice}
                          onChangeText={(v) =>
                            setInputs((p) => ({ ...p, subPrice: v }))
                          }
                          style={strictInputStyle}
                        />
                      </View>
                    </View>
                  </View>

                  <View className="flex-col md:flex-row md:gap-4">
                    <View className="w-full mb-4 md:flex-1 md:mb-0">
                      <View className="flex-row items-center gap-1.5 mb-2">
                        <Clock size={12} color={THEME.warning} />
                        <Text className="text-[9px] font-black text-white/80 uppercase tracking-widest">
                          Est. Mins/User
                        </Text>
                      </View>
                      <View className="justify-center h-12 px-4 border bg-black/40 border-white/10 rounded-xl">
                        <TextInput
                          keyboardType="numeric"
                          value={inputs.avgMins}
                          onChangeText={(v) =>
                            setInputs((p) => ({ ...p, avgMins: v }))
                          }
                          style={strictInputStyle}
                        />
                      </View>
                    </View>
                    <View className="w-full mb-4 md:flex-1 md:mb-0">
                      <View className="flex-row items-center gap-1.5 mb-2">
                        <Landmark size={12} color={THEME.danger} />
                        <Text className="text-[9px] font-black text-white/80 uppercase tracking-widest">
                          Store %
                        </Text>
                      </View>
                      <View className="justify-center h-12 px-4 border bg-black/40 border-white/10 rounded-xl">
                        <TextInput
                          keyboardType="numeric"
                          value={inputs.storeFee}
                          onChangeText={(v) =>
                            setInputs((p) => ({ ...p, storeFee: v }))
                          }
                          style={strictInputStyle}
                        />
                      </View>
                    </View>
                    <View className="w-full md:flex-1">
                      <View className="flex-row items-center gap-1.5 mb-2">
                        <Receipt size={12} color={THEME.danger} />
                        <Text className="text-[9px] font-black text-white/80 uppercase tracking-widest">
                          VAT / Tax %
                        </Text>
                      </View>
                      <View className="justify-center h-12 px-4 border bg-black/40 border-white/10 rounded-xl">
                        <TextInput
                          keyboardType="numeric"
                          value={inputs.taxRate}
                          onChangeText={(v) =>
                            setInputs((p) => ({ ...p, taxRate: v }))
                          }
                          style={strictInputStyle}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* ─── OUTPUTS ─── */}
                <View className="justify-center flex-1 lg:pl-4">
                  <View className="flex-row items-end justify-between pb-6 mb-6 border-b border-white/5">
                    <View>
                      <Text className="mb-1 text-[10px] font-black tracking-widest text-white/40 uppercase">
                        Gross MRR
                      </Text>
                      <Text className="text-4xl font-black tracking-tighter text-white">
                        {formatter.format(saasFinancials.gross)}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-[9px] font-mono text-[#FF007F]">
                        - {formatter.format(saasFinancials.storeCut)} (Store)
                      </Text>
                      <Text className="text-[9px] font-mono text-[#FF007F]">
                        - {formatter.format(saasFinancials.taxCut)} (Tax)
                      </Text>
                      <Text className="text-[9px] font-mono text-[#8A2BE2]">
                        - {formatter.format(saasFinancials.apiCost)} (API)
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-end justify-between">
                    <View>
                      <Text className="mb-1 text-[10px] font-black text-[#32FF00] uppercase tracking-widest">
                        Net Profit Forecast
                      </Text>
                      <Text className="text-3xl font-black tracking-tighter text-[#32FF00]">
                        {formatter.format(saasFinancials.net)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="mb-1 text-[9px] font-black text-white/40 uppercase tracking-widest">
                        Margin
                      </Text>
                      <Text className="text-xl font-black text-white">
                        {saasFinancials.margin.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* ════════ 6. IDENTITY REGISTRY ════════ */}
            <View className="flex-row items-center gap-3 mb-6">
              <Users size={14} color="#fff" />
              <Text className="text-[10px] md:text-[11px] font-black text-white tracking-[3px] uppercase">
                USERS PREVIEW
              </Text>
            </View>

            <GlassCard className="p-0 border bg-white/[0.015] border-white/5 rounded-3xl mb-12 overflow-hidden">
              <View className="hidden md:flex flex-row items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/5">
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest w-1/3 pr-4">
                  Profile
                </Text>
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest w-1/4">
                  Role
                </Text>
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest w-1/4">
                  API Config
                </Text>
                <View className="w-8" />
              </View>

              {registryPreview.length === 0 ? (
                <ActivityIndicator color={THEME.cyan} className="py-12" />
              ) : (
                registryPreview.map((profile, idx) => (
                  <TouchableOpacity
                    key={profile.id}
                    activeOpacity={0.7}
                    delayPressIn={0} // CRITICAL FIX: Instant tap registration
                    onPress={() => router.push('/admin/users')}
                    className={cn(
                      'flex-col md:flex-row md:items-center px-6 py-5 hover:bg-white/[0.02] transition-colors',
                      idx !== registryPreview.length - 1 &&
                        'border-b border-white/5',
                    )}
                  >
                    <View className="w-full mb-3 md:w-1/3 md:pr-4 md:mb-0">
                      <Text
                        className="text-sm font-bold md:text-xs text-white/90"
                        numberOfLines={1}
                      >
                        {profile.full_name || 'Anonymous'}
                      </Text>
                      <Text
                        className="text-[10px] md:text-[9px] text-white/40 font-mono mt-1 md:mt-0.5"
                        numberOfLines={1}
                      >
                        {profile.email}
                      </Text>
                    </View>
                    <View className="flex-row w-full mb-3 md:w-1/4 md:mb-0">
                      <View
                        className={cn(
                          'px-2 py-1 rounded border',
                          profile.role === 'admin'
                            ? 'bg-[#8A2BE2]/10 border-[#8A2BE2]/30'
                            : profile.role === 'premium'
                              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30'
                              : 'bg-white/5 border-white/10',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-[8px] font-black uppercase tracking-widest',
                            profile.role === 'admin'
                              ? 'text-[#8A2BE2]'
                              : profile.role === 'premium'
                                ? 'text-[#F59E0B]'
                                : 'text-white/50',
                          )}
                        >
                          {profile.role || 'MEMBER'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center w-full gap-2 mb-2 md:w-1/4 md:mb-0">
                      {/* FIX: Strict JS Ternary for size prop */}
                      <KeyRound
                        size={isMobile ? 12 : 10}
                        color={
                          profile.custom_api_key ? THEME.success : THEME.cyan
                        }
                        opacity={0.6}
                      />
                      <Text
                        className={cn(
                          'font-mono text-[10px] md:text-[9px] font-bold',
                          profile.custom_api_key
                            ? 'text-[#32FF00]'
                            : 'text-[#00F0FF]',
                        )}
                      >
                        {profile.custom_api_key ? '[BYO-KEY]' : '[SYSTEM]'}
                      </Text>
                    </View>
                    <View className="items-end hidden w-8 md:flex">
                      <ChevronRight size={14} color="#ffffff30" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </GlassCard>

            {/* ════════ 7. REAL-TIME ENGINE STREAM (PERFECTED RESPONSIVE TABLE) ════════ */}
            <View className="flex-row items-center gap-3 mb-6">
              <History size={14} color="#fff" />
              <Text className="text-[10px] md:text-[11px] font-black text-white tracking-[3px] uppercase">
                Real-Time Engine Stream
              </Text>
            </View>

            <GlassCard className="p-0 border bg-white/[0.015] border-white/5 rounded-3xl overflow-hidden">
              {/* Desktop Header Row (Strict Grid Match) */}
              <View className="hidden md:flex flex-row items-center px-6 py-4 bg-white/[0.02] border-b border-white/5">
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest w-1/3 pr-4">
                  Event Type
                </Text>
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest flex-1">
                  Metadata
                </Text>
                <Text className="text-[9px] font-black text-white/40 uppercase tracking-widest w-24 text-right">
                  Timestamp
                </Text>
              </View>

              {liveStream.length === 0 ? (
                <ActivityIndicator color={THEME.cyan} className="py-12" />
              ) : (
                liveStream.map((log, idx) => (
                  <Animated.View
                    key={log.id}
                    entering={FadeInDown.delay(idx * 50)}
                    className={cn(
                      'flex-col md:flex-row md:items-center px-6 py-5 hover:bg-white/[0.03] transition-colors',
                      idx !== liveStream.length - 1 &&
                        'border-b border-white/5',
                    )}
                  >
                    {/* Event Type (Desktop: w-1/3, Mobile: Full width header) */}
                    <View className="flex-row items-center justify-between w-full pr-0 mb-3 md:w-1/3 md:pr-4 md:mb-0">
                      <View className="flex-row items-center flex-1 pr-2">
                        <View className="items-center justify-center w-8 h-8 mr-3 border rounded-lg bg-white/[0.03] border-white/10 shrink-0">
                          {log.action.includes('ai') ? (
                            <Cpu size={14} color={THEME.purple} />
                          ) : (
                            <Zap size={14} color={THEME.cyan} />
                          )}
                        </View>
                        <Text
                          className="text-xs font-bold tracking-wide capitalize md:text-sm text-white/90 shrink"
                          numberOfLines={1}
                        >
                          {log.action.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      {/* Mobile Timestamp */}
                      <Text className="md:hidden text-[9px] font-mono text-white/40 shrink-0 ml-2">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </Text>
                    </View>

                    {/* Metadata Tags (Desktop: flex-1, Mobile: Full width wrap) */}
                    <View className="flex-row flex-wrap items-center w-full gap-2 md:flex-1">
                      <View className="px-2 py-1 border rounded bg-[#00F0FF]/10 border-[#00F0FF]/20">
                        <Text className="text-[8px] md:text-[9px] font-mono font-bold text-[#00F0FF]">
                          {log.actual_tokens_burned || 0} TOKENS
                        </Text>
                      </View>
                      {log.ai_model_name && (
                        <View className="px-2 py-1 border rounded bg-[#8A2BE2]/10 border-[#8A2BE2]/20">
                          <Text className="text-[8px] font-black text-[#8A2BE2] uppercase tracking-wider">
                            {log.ai_model_name}
                          </Text>
                        </View>
                      )}
                      <Text className="text-[8px] md:text-[9px] font-black text-white/30 uppercase tracking-widest mt-1 md:mt-0">
                        USR: {log.user_id.slice(0, 8)}
                      </Text>
                    </View>

                    {/* Desktop Timestamp (Desktop: w-24) */}
                    <View className="items-end justify-end hidden w-24 pl-4 md:flex">
                      <Text className="text-[10px] font-mono text-white/40 text-right">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                  </Animated.View>
                ))
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
