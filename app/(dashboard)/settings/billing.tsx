/**
 * app/(dashboard)/settings/billing.tsx
 * VeraxAI Architect — Token Economy
 * ══════════════════════════════════════════════════════════════════════════════
 * NEBULA AMBIENT ENGINE
 * REAL-TIME LEDGER: Bi-directional sync with Supabase `profiles` & `usage_logs`.
 * TOKEN ECONOMY: Renders dynamic progress bars based on current user_role.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowBigLeftDash,
  Zap,
  Star,
  Crown,
  Info,
  Coins,
  RefreshCw,
  Activity,
  ShieldCheck,
  ChevronRight,
  DatabaseZap,
  History,
  ZapOff,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase/client';
import { Database } from '../../../types/database/database.types';

// ─── ANIMATION ENGINE & SVG ──────────────────────────────────────────────────
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  withDelay,
  Easing,
  useFrameCallback,
} from 'react-native-reanimated';

// ─── THEME CONSTANTS (Liquid Neon) ───────────────────────────────────────────
const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#32FF00',
  gold: '#FFD700',
  red: '#FF3366',
};

const IS_WEB = Platform.OS === 'web';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: NEBULA AMBIENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const CorePulse = memo(({ delay, color, size, centerX, centerY }: any) => {
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
});
CorePulse.displayName = 'CorePulse';

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

const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;

  const coreX = width / 2;
  const coreY = isDesktop ? 160 : 120;
  const basePulseSize = isDesktop ? 300 : 200;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <CorePulse
        delay={0}
        color={THEME.pink}
        size={basePulseSize}
        centerX={coreX}
        centerY={coreY}
      />
      <CorePulse
        delay={3000}
        color={THEME.purple}
        size={basePulseSize}
        centerX={coreX}
        centerY={coreY}
      />

      <OrganicOrb
        color={THEME.gold}
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
        opacityBase={0.06}
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: ANIMATED SVG HEADER (The Ledger Core)
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedLedgerIcon = () => {
  const floatY = useSharedValue(0);
  const dataPulse = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    dataPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const dataBlock1 = useAnimatedStyle(() => ({
    opacity: interpolate(dataPulse.value, [0, 1], [0.3, 1]),
  }));
  const dataBlock2 = useAnimatedStyle(() => ({
    opacity: interpolate(dataPulse.value, [0, 1], [1, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: 140,
          height: 140,
          alignItems: 'center',
          justifyContent: 'center',
        },
        floatStyle,
      ]}
    >
      {/* Outer Database Shell */}
      <Svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        style={{ position: 'absolute' }}
      >
        {/* Base Cylinder */}
        <Path
          d="M 20 40 L 20 90 A 40 15 0 0 0 100 90 L 100 40"
          fill="rgba(138,43,226,0.1)"
          stroke={THEME.purple}
          strokeWidth="2"
          opacity="0.8"
        />
        <Path
          d="M 20 40 A 40 15 0 0 0 100 40 A 40 15 0 0 0 20 40"
          fill="rgba(255,215,0,0.1)"
          stroke={THEME.gold}
          strokeWidth="2"
        />
        <Path
          d="M 20 65 A 40 15 0 0 0 100 65"
          fill="none"
          stroke={THEME.purple}
          strokeWidth="2"
          opacity="0.5"
        />
      </Svg>

      {/* Floating Data Blocks inside */}
      <Animated.View
        style={[{ position: 'absolute', top: 55, left: 40 }, dataBlock1]}
      >
        <Svg width="40" height="10" viewBox="0 0 40 10">
          <Rect width="15" height="4" rx="2" fill={THEME.gold} />
          <Rect x="20" width="10" height="4" rx="2" fill={THEME.cyan} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[{ position: 'absolute', top: 75, left: 50 }, dataBlock2]}
      >
        <Svg width="40" height="10" viewBox="0 0 40 10">
          <Rect width="8" height="4" rx="2" fill={THEME.cyan} />
          <Rect x="12" width="18" height="4" rx="2" fill={THEME.gold} />
        </Svg>
      </Animated.View>

      {/* Orbiting Coin Node */}
      <View style={{ position: 'absolute', top: 10, right: 10 }}>
        <Svg width="30" height="30" viewBox="0 0 30 30">
          <Circle
            cx="15"
            cy="15"
            r="10"
            fill="rgba(255,215,0,0.2)"
            stroke={THEME.gold}
            strokeWidth="2"
          />
          <Circle cx="15" cy="15" r="4" fill={THEME.gold} />
        </Svg>
      </View>
    </Animated.View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: ECONOMIC CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const ROLE_CONFIG = {
  member: {
    label: 'Standard Member',
    color: THEME.cyan,
    icon: Zap,
    badge: 'FREE PLAN',
    allowance: 50,
    resetLabel: 'Refills 50 credits daily at 00:00 UTC',
  },
  premium: {
    label: 'Premium',
    color: THEME.gold,
    icon: Star,
    badge: 'PREMIUM ($10/MO)',
    allowance: 2000,
    resetLabel: 'Monthly 2,000 credit limit active',
  },
  admin: {
    label: 'Enterprise / Admin',
    color: THEME.red,
    icon: Crown,
    badge: 'UNLIMITED',
    allowance: 100000, // Effectively infinite for UI meter
    resetLabel: 'High-volume administrative reserve active',
  },
  support: {
    label: 'Support Node',
    color: THEME.purple,
    icon: ShieldCheck,
    badge: 'SUPPORT',
    allowance: 5000,
    resetLabel: 'Internal support quota active',
  },
};

const PROTOCOLS = {
  member: [
    '50 Token Daily Refill Protocol',
    'Standard Speech-to-Text Speed',
    'YouTube Metadata Extraction (Free)',
    'Community Support Infrastructure',
  ],
  premium: [
    '2,000 Token Monthly Reservoir for $10/mo',
    'Use your own API key for a small fee',
    'Priority Neural Processing',
    'Full Export Layers (SRT/VTT/JSON)',
    'Dedicated Slack Support Node',
  ],
  admin: [
    'Custom Bulk Token Allocation',
    'Zero-Latency Synthesis Node',
    'Custom Prompt Engineering Vault',
    'Batch Video Submission Access',
    'Dedicated Account Architect',
  ],
  support: ['Support network access', 'System diagnostic tools'],
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: MAIN SCREEN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function BillingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [role, setRole] =
    useState<Database['public']['Enums']['user_role']>('member');
  const [balance, setBalance] = useState(0);
  const [consumed, setConsumed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ── DATA FETCH ENGINE ──
  const syncEconomy = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('role, tokens_balance')
        .eq('id', user.id)
        .single();

      if (pErr) throw pErr;
      if (!profile) throw new Error('Profile not found');

      const currentRole = profile.role || 'member';
      setRole(currentRole);
      setBalance(profile.tokens_balance || 0);

      // Aggregate Consumption Logs based on role cycle
      const now = new Date();
      const cycleStart =
        currentRole === 'member'
          ? new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            ).toISOString()
          : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: logs } = await supabase
        .from('usage_logs')
        .select('tokens_consumed')
        .eq('user_id', user.id)
        .gte('created_at', cycleStart);

      const totalBurn =
        logs?.reduce((acc, log) => acc + (log.tokens_consumed || 0), 0) || 0;
      setConsumed(totalBurn);
    } catch (err) {
      console.error('[ECONOMY FAULT]: Identity Sync Interrupted.', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    syncEconomy();
  }, [syncEconomy]);

  const config = ROLE_CONFIG[role] || ROLE_CONFIG.member;
  // Calculate percentage used, ensuring it doesn't break styling if > 100%
  const usagePercentage = Math.min(
    100,
    Math.max(0, (consumed / config.allowance) * 100),
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={THEME.cyan} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.rootContainer}>
      {/* ── NEBULA AMBIENT BACKGROUND ── */}
      <AmbientArchitecture />

      {/* ── CORE SCROLL ENGINE ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexOne}
      >
        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.maxLayoutWidth}>
            {/* ── RETURN BUTTON (Icon Only) ── */}
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/settings')
              }
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <ArrowBigLeftDash size={24} color={config.color} />
            </TouchableOpacity>

            {/* ── PAGE HEADER (ANIMATED LEDGER) ── */}
            <FadeIn>
              <View className="flex-row items-center justify-between mb-12">
                <View className="items-center justify-center">
                  <AnimatedLedgerIcon />
                  <View
                    style={{
                      backgroundColor: config.color,
                      shadowColor: config.color,
                    }}
                    className="h-1 w-20 mt-4 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  />
                </View>

                <View
                  style={{
                    backgroundColor: `${config.color}15`,
                    borderColor: `${config.color}40`,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color: config.color,
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 2,
                    }}
                  >
                    {config.badge}
                  </Text>
                </View>
              </View>
            </FadeIn>

            {/* ── MODULE: CAPACITY METER ── */}
            <FadeIn delay={100}>
              <GlassCard style={styles.glassCardOverride}>
                <View style={styles.statusHeaderRow}>
                  <View>
                    <Text style={styles.metaLabel}>Current Allocation</Text>
                    <View style={styles.roleNameBlock}>
                      <config.icon size={24} color={config.color} />
                      <Text style={styles.roleLabelText}>{config.label}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.meterContainer}>
                  <View style={styles.meterInfoRow}>
                    <View style={styles.meterLabelBlock}>
                      <Coins size={16} color={THEME.cyan} />
                      <Text style={styles.meterTitle}>Available Credits</Text>
                    </View>
                    <Text style={styles.balanceValue}>
                      {balance.toLocaleString()}
                    </Text>
                  </View>

                  {/* Dynamic Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          // Width represents remaining credits
                          width: `${100 - usagePercentage}%`,
                          backgroundColor: config.color,
                          ...(IS_WEB
                            ? ({ boxShadow: `0 0 10px ${config.color}` } as any)
                            : {}),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.meterFooter}>
                    <View style={styles.footerInfoBlock}>
                      <RefreshCw size={12} color="rgba(255,255,255,0.3)" />
                      <Text style={styles.footerText}>{config.resetLabel}</Text>
                    </View>
                    <Text style={styles.consumedText}>
                      <Text style={{ color: THEME.pink, fontWeight: 'bold' }}>
                        {consumed.toLocaleString()}
                      </Text>{' '}
                      burned
                    </Text>
                  </View>
                </View>

                {/* PROTOCOL LIST */}
                <View style={styles.protocolBlock}>
                  <Text style={styles.metaLabel}>Active Features</Text>
                  <View style={styles.protocolList}>
                    {(PROTOCOLS[role] || PROTOCOLS.member).map(
                      (protocol, i) => (
                        <View key={i} style={styles.protocolRow}>
                          <ShieldCheck size={14} color={`${config.color}70`} />
                          <Text style={styles.protocolText}>{protocol}</Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              </GlassCard>
            </FadeIn>

            {/* ── MODULE: UPGRADE PATH ── */}
            {role === 'member' && (
              <FadeIn delay={200}>
                <GlassCard style={styles.glassCardOverride}>
                  <View style={styles.upgradeHeader}>
                    <DatabaseZap size={20} color={THEME.gold} />
                    <Text style={styles.upgradeTitle}>Expand Capabilities</Text>
                  </View>
                  <Text style={styles.upgradeSubtext}>
                    Upgrade to PREMIUM to unlock 2,000 monthly processing
                    credits, sovereign API vault access, and maximum execution
                    speeds.
                  </Text>

                  <View style={styles.ctaGrid}>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL('https://veraxai.vercel.app/')
                      }
                      style={styles.proCta}
                      activeOpacity={0.8}
                    >
                      <Star size={18} color={THEME.gold} />
                      <Text style={styles.proCtaText}>Upgrade for $10/mo</Text>
                      <ChevronRight size={14} color={THEME.gold} />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </FadeIn>
            )}

            {/* ── MODULE: TRANSACTION LEDGER ── */}
            <FadeIn delay={300}>
              <View style={styles.ledgerHeader}>
                <History size={18} color="rgba(255,255,255,0.4)" />
                <Text style={styles.ledgerTitleText}>Usage Analytics</Text>
              </View>

              <GlassCard
                style={[
                  styles.glassCardOverride,
                  { alignItems: 'center', paddingVertical: 40 },
                ]}
              >
                <Activity size={32} color="rgba(255,255,255,0.1)" />
                <Text style={styles.ledgerEmptyText}>Ledger Node Active</Text>
                <Text style={styles.ledgerEmptySub}>
                  Total Processing Minutes Consumed this Cycle:{' '}
                  <Text style={{ color: THEME.cyan, fontWeight: 'bold' }}>
                    {consumed}
                  </Text>
                </Text>
              </GlassCard>
            </FadeIn>

            {/* ── FOOTER ── */}
            <View style={styles.footerBlock}>
              <Info size={14} color="rgba(255,255,255,0.3)" />
              <Text style={styles.footerLegal}>
                Resource allocation governed by the VeraxAI protocol. Free tier
                limits enforce fair platform access.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── LOCAL STYLESHEET ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: THEME.obsidian },
  flexOne: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.obsidian,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  maxLayoutWidth: { maxWidth: 700, alignSelf: 'center', width: '100%' },
  backButton: { marginBottom: 32, alignSelf: 'flex-start' },
  glassCardOverride: {
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  roleNameBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleLabelText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  meterContainer: { marginBottom: 24 },
  meterInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meterLabelBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  meterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfoBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  consumedText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '500',
  },
  protocolBlock: {
    marginTop: 12,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  protocolList: { gap: 14 },
  protocolRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  protocolText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  upgradeTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  upgradeSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaGrid: { flexDirection: 'column' },
  proCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  proCtaText: {
    color: THEME.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  ledgerTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  ledgerEmptyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  ledgerEmptySub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  footerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  footerLegal: {
    flex: 1,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    lineHeight: 16,
  },
});
