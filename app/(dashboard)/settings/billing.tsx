/**
 * app/(dashboard)/settings/billing.tsx
 * VertAI — Resource Allocation & Token Economy
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL:
 * 1. TRIPLE-FLEX ARCHITECTURE: SafetyView -> Keyboard -> Scroll flex mapping.
 * 2. REAL-TIME LEDGER: Bi-directional sync with Supabase profiles and usage logs.
 * 3. TOKEN ECONOMY: Member (50 Daily Refill) | Premium ($10 Monthly) | Admin (10K+ Custom).
 * 4. WEB STABILITY: Native shadow props used to bypass NativeWind boxShadow crashes.
 * 5. SCROLL ENGINE: flexGrow: 1 with 150px padding offset for infinite scroll.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
} from 'react-native-reanimated';

// ─── MODULE 1: AMBIENT VISUAL ENGINE ────────────────────────────────────────

const NeuralOrb = ({
  delay = 0,
  color = '#8A2BE2',
}: {
  delay?: number;
  color?: string;
}) => {
  const pulse = useSharedValue(0);
  const { width } = Dimensions.get('window');

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 12000 }), -1, true),
    );
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.4]) },
      { translateX: interpolate(pulse.value, [0, 1], [0, width * 0.03]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.03, 0.07]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        animatedStyle,
        {
          position: 'absolute',
          width: 700,
          height: 700,
          backgroundColor: color,
          borderRadius: 350,
          ...(Platform.OS === 'web' ? ({ filter: 'blur(140px)' } as any) : {}),
        },
      ]}
    />
  );
};

// ─── MODULE 2: ECONOMIC CONFIGURATION ───────────────────────────────────────

const ROLE_CONFIG = {
  member: {
    label: 'Standard Member',
    color: '#00F0FF',
    icon: Zap,
    badge: 'FREE PLAN',
    allowance: 50,
    resetLabel: 'Refills daily at 00:00 UTC',
  },
  premium: {
    label: 'Premium',
    color: '#FFD700',
    icon: Star,
    badge: 'PREMIUM ($10/MO)',
    allowance: 2000,
    resetLabel: 'Monthly quota reset active',
  },
  admin: {
    label: 'Enterprise / Admin',
    color: '#FF3366',
    icon: Crown,
    badge: 'UNLIMITED',
    allowance: 10000,
    resetLabel: 'High-volume reserve active',
  },
  support: {
    label: 'Support Node',
    color: '#8A2BE2',
    icon: ShieldCheck,
    badge: 'SUPPORT',
    allowance: 5000,
    resetLabel: 'Support quota active',
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

// ─── MODULE 3: MAIN COMPONENT ───────────────────────────────────────────────

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
      // 1. Sync Base Profile
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

      // 2. Aggregate Consumption Logs
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
  const usagePercentage = Math.min(100, (consumed / config.allowance) * 100);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00F0FF" size="large" />
        <Text style={styles.loadingText}>Accessing Ledger Nodes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.rootContainer}>
      {/* ── AMBIENT CANVAS ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <NeuralOrb delay={0} color="#8A2BE2" />
        <NeuralOrb delay={6000} color="#00F0FF" />
      </View>

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
            {/* ── HEADER ── */}
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/settings')
              }
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ArrowBigLeftDash size={22} color={config.color} />
              <Text style={[styles.backText, { color: config.color }]}>
                System Return
              </Text>
            </TouchableOpacity>

            <FadeIn>
              <View style={styles.headerTitleBlock}>
                <Text style={styles.moduleBadge}>Economy Interface</Text>
                <Text style={styles.mainTitle}>
                  Resource{' '}
                  <Text style={{ color: config.color }}>Allocation</Text>
                </Text>
                <View
                  style={[styles.titleRule, { backgroundColor: config.color }]}
                />
              </View>
            </FadeIn>

            {/* ── MODULE: IDENTITY STATUS ── */}
            <FadeIn delay={100}>
              <GlassCard style={styles.glassCardOverride}>
                <View style={styles.statusHeaderRow}>
                  <View>
                    <Text style={styles.metaLabel}>Active clearance</Text>
                    <View style={styles.roleNameBlock}>
                      <config.icon size={26} color={config.color} />
                      <Text style={styles.roleLabelText}>{config.label}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.badgeContainer,
                      {
                        borderColor: `${config.color}40`,
                        backgroundColor: `${config.color}12`,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: config.color }]}>
                      {config.badge}
                    </Text>
                  </View>
                </View>

                {/* CAPACITY METER */}
                <View style={styles.meterContainer}>
                  <View style={styles.meterInfoRow}>
                    <View style={styles.meterLabelBlock}>
                      <Coins size={16} color="#FFD700" />
                      <Text style={styles.meterTitle}>Reserve Tokens</Text>
                    </View>
                    <Text style={styles.balanceValue}>
                      {balance.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${100 - usagePercentage}%`,
                          backgroundColor: config.color,
                          // SAFE NATIVE SHADOWS
                          shadowColor: config.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.8,
                          shadowRadius: 10,
                          elevation: 5,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.meterFooter}>
                    <View style={styles.footerInfoBlock}>
                      <RefreshCw size={12} color="rgba(255,255,255,0.2)" />
                      <Text style={styles.footerText}>{config.resetLabel}</Text>
                    </View>
                    <Text style={styles.consumedText}>{consumed} burned</Text>
                  </View>
                </View>

                {/* PROTOCOL LIST */}
                <View style={styles.protocolBlock}>
                  <Text style={styles.metaLabel}>Active Network Protocols</Text>
                  <View style={styles.protocolList}>
                    {role !== 'member' && (
                      <View style={styles.protocolRow}>
                        <ZapOff size={14} color={`${config.color}70`} />
                        <Text style={styles.protocolText}>
                          {role === 'premium'
                            ? 'Bypass Standard Queue Protocol'
                            : 'Standard Priority Queue Access'}
                        </Text>
                      </View>
                    )}

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

            {/* ── MODULE: SCALING OPTIONS ── */}
            {role === 'member' && (
              <FadeIn delay={200}>
                <GlassCard style={styles.glassCardOverride}>
                  <View style={styles.upgradeHeader}>
                    <DatabaseZap size={20} color="#FFD700" />
                    <Text style={styles.upgradeTitle}>
                      Expand Core Reservoirs
                    </Text>
                  </View>
                  <Text style={styles.upgradeSubtext}>
                    Upgrade to PREMIUM for $10 USD/mo to get 2,000 tokens each
                    month, and use your own API key for a small fee.
                  </Text>

                  <View style={styles.ctaGrid}>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL('https://veraxai.vercel.app/')
                      }
                      style={styles.proCta}
                      activeOpacity={0.8}
                    >
                      <Star size={18} color="#FFD700" />
                      <Text style={styles.proCtaText}>
                        Upgrade to Premium ($10/mo)
                      </Text>
                      <ChevronRight size={14} color="#FFD700" />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </FadeIn>
            )}

            {/* ── MODULE: TRANSACTION LEDGER ── */}
            <FadeIn delay={300}>
              <View style={styles.ledgerHeader}>
                <History size={18} color="rgba(255,255,255,0.4)" />
                <Text style={styles.ledgerTitleText}>System Ledger</Text>
              </View>

              <GlassCard style={styles.glassCardOverride}>
                <View style={styles.ledgerEmptyState}>
                  <Activity size={32} color="rgba(255,255,255,0.1)" />
                  <Text style={styles.ledgerEmptyText}>
                    No recent token migrations detected.
                  </Text>
                  <Text style={styles.ledgerEmptySub}>
                    All resource allocations are logged in real-time.
                  </Text>
                </View>
              </GlassCard>
            </FadeIn>

            {/* ── FOOTER ── */}
            <View style={styles.footerBlock}>
              <Info size={14} color="rgba(255,255,255,0.3)" />
              <Text style={styles.footerLegal}>
                Resource allocation is subject to the VertAI Protocol Terms of
                Service. Token refills occur at 00:00 UTC for Standard Members.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#010314' },
  flexOne: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#010314',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00F0FF',
    marginTop: 20,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
    paddingHorizontal: 20,
  },
  maxLayoutWidth: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
    gap: 10,
  },
  backText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerTitleBlock: {
    marginBottom: 40,
  },
  moduleBadge: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  titleRule: {
    height: 2,
    width: 40,
    marginTop: 16,
    borderRadius: 1,
  },
  glassCardOverride: {
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    letterSpacing: 1,
    marginBottom: 12,
  },
  roleNameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleLabelText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  meterContainer: {
    marginBottom: 24,
  },
  meterInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meterLabelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meterTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  meterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  consumedText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  protocolBlock: {
    marginTop: 8,
  },
  protocolList: {
    gap: 12,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  protocolText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upgradeSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  ctaGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  proCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  proCtaText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  enterpriseCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.3)',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  enterpriseCtaText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  ledgerTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  ledgerEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  ledgerEmptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  ledgerEmptySub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
  },
  footerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 4,
  },
  footerLegal: {
    flex: 1,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    lineHeight: 18,
  },
});
