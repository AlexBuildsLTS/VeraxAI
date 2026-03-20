/**
 * FILE: app/(dashboard)/settings/billing.tsx
 *
 * Resource Allocation — shows current tier, monthly usage, and upgrades
 * Reads from workspaces tier, minutes used this month, monthly minutes limit
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Dimensions,
  Linking,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowBigLeftDash,
  Zap,
  Star,
  Crown,
  TrendingUp,
  Info,
} from 'lucide-react-native';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase/client';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
} from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────────────────────
// Ambient orb
// ─────────────────────────────────────────────────────────────────────────────

const NeuralOrb = ({
  delay = 0,
  color = '#00F0FF',
}: {
  delay?: number;
  color?: string;
}) => {
  const pulse = useSharedValue(0);
  const { width, height } = Dimensions.get('window');
  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 8000 }), -1, true),
    );
  }, []);
  const s = useAnimatedStyle(() => ({
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
        s,
        {
          position: 'absolute',
          width: 600,
          height: 600,
          backgroundColor: color,
          borderRadius: 300,
          ...(Platform.OS === 'web' ? ({ filter: 'blur(120px)' } as any) : {}),
        },
      ]}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TIER_META: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<any> }
> = {
  free: { label: 'On-Demand', color: '#A1A1AA', icon: Zap },
  pro: { label: 'Teams', color: '#00F0FF', icon: Star },
  enterprise: { label: 'Enterprise Suite', color: '#8A2BE2', icon: Crown },
};

const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'Standard processing speed',
    'Videos up to 15 minutes',
    'YouTube caption extraction',
    'Gemini AI insights',
    'Community support',
  ],
  pro: [
    'Priority processing',
    'Videos up to 2 hours',
    'All caption + audio layers',
    'Gemini 2.5 Pro + Claude AI',
    'Export to SRT / VTT / JSON',
    'SLA support',
  ],
  enterprise: [
    'Instant processing',
    'Unlimited video length',
    'RapidAPI + all extraction layers',
    'Custom AI prompt templates',
    'Batch submission',
    'Custom webhooks',
    'Dedicated support agent',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  const [tier, setTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(60);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();
      if (!member) return setIsLoading(false);

      const { data } = await supabase
        .from('workspaces')
        .select('tier, minutes_used_this_month, monthly_minutes_limit')
        .eq('id', member.workspace_id)
        .single();

      if (data) {
        setTier((data.tier as any) ?? 'free');
        setUsed(data.minutes_used_this_month ?? 0);
        setLimit(data.monthly_minutes_limit ?? 60);
      }
      setIsLoading(false);
    })();
  }, [user]);

  const meta = TIER_META[tier] ?? TIER_META.free;
  const TierIcon = meta.icon;
  const pct = Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0);
  const barColor = pct > 85 ? '#FF007F' : meta.color;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
          <NeuralOrb delay={0} color="#8A2BE2" />
          <NeuralOrb delay={2500} color="#00F0FF" />
        </View>
        <ActivityIndicator color="#8A2BE2" size="large" />
        <Text style={styles.loadingText}>Loading Allocation...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#8A2BE2" />
        <NeuralOrb delay={2500} color="#00F0FF" />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: isMobile ? 20 : 60,
          paddingTop: isMobile ? 60 : 60,
          paddingBottom: 160,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowBigLeftDash size={18} color="#8A2BE2" />
          <Text style={styles.backText}>RETURN</Text>
        </TouchableOpacity>

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <FadeIn>
          <View style={{ marginBottom: 32 }}>
            <Text style={styles.moduleBadge}>BILLING</Text>
            <Text style={styles.pageTitle}>
              Resource <Text style={{ color: '#8A2BE2' }}>Allocation</Text>
            </Text>
            <View style={styles.headingRule} />
          </View>
        </FadeIn>

        {/* ── Current tier card ────────────────────────────────────────── */}
        <FadeIn delay={100}>
          <GlassCard glowColor="purple" className="p-8 mb-5">
            {/* Tier header */}
            <View style={styles.tierHeader}>
              <View>
                <Text style={styles.sectionLabel}>Current Tier</Text>
                <View style={styles.tierNameRow}>
                  <TierIcon size={18} color={meta.color} />
                  <Text style={[styles.tierName, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.tierBadge,
                  {
                    borderColor: meta.color + '50',
                    backgroundColor: meta.color + '18',
                  },
                ]}
              >
                <Text style={[styles.tierBadgeText, { color: meta.color }]}>
                  {tier.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Usage bar */}
            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <View style={styles.usageRow}>
                <View style={styles.usageLabelRow}>
                  <TrendingUp size={12} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.usageLabel}>Minutes this month</Text>
                </View>
                <Text style={styles.usageCount}>
                  {used} / {limit} min
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${pct}%` as any,
                      backgroundColor: barColor,
                      shadowColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barHint}>
                {pct}% used — resets on the 1st of each month
              </Text>
            </View>

            {/* Feature list */}
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionLabel, { marginBottom: 14 }]}>
                Plan includes
              </Text>
              {(TIER_FEATURES[tier] ?? []).map((f) => (
                <View key={f} style={styles.featureRow}>
                  <View
                    style={[styles.featureDot, { backgroundColor: meta.color }]}
                  />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </FadeIn>

        {/* ── Upgrade CTAs ─────────────────────────────────────────────── */}
        {tier !== 'enterprise' && (
          <FadeIn delay={200}>
            <GlassCard glowColor="cyan" className="p-8 mb-5">
              <Text style={styles.upgradeTitle}>Upgrade Your Node</Text>
              <Text style={styles.upgradeSubtitle}>
                Unlock longer videos, priority processing, and advanced AI
                layers.
              </Text>

              {tier === 'free' && (
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL('https://transcriber-pro.vercel.app/')
                  }
                  style={styles.ctaCyan}
                  activeOpacity={0.75}
                >
                  <Star size={15} color="#00F0FF" />
                  <Text style={styles.ctaCyanText}>
                    Teams Plan — $29 / month
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://transcriber-pro.vercel.app/')
                }
                style={styles.ctaPurple}
                activeOpacity={0.75}
              >
                <Crown size={15} color="#8A2BE2" />
                <Text style={styles.ctaPurpleText}>
                  Enterprise Suite — $99 / month
                </Text>
              </TouchableOpacity>

              <Text style={styles.stripeHint}>
                Billing managed via Stripe · Cancel anytime
              </Text>
            </GlassCard>
          </FadeIn>
        )}

        {/* ── How minutes work ─────────────────────────────────────────── */}
        <FadeIn delay={300}>
          <GlassCard glowColor="purple" className="p-8">
            <View style={styles.infoHeader}>
              <Info size={14} color="rgba(255,255,255,0.3)" />
              <Text
                style={[
                  styles.sectionLabel,
                  { marginBottom: 0, marginLeft: 8 },
                ]}
              >
                How minutes are counted
              </Text>
            </View>
            <View style={{ marginTop: 16, gap: 12 }}>
              {[
                'Minutes are counted only when audio is sent to Deepgram for speech-to-text.',
                'Videos transcribed via YouTube captions (no audio needed) do not consume minutes.',
                'Failed jobs are never billed against your quota.',
                'Usage resets automatically on the 1st of each month.',
              ].map((line) => (
                <View key={line} style={styles.infoRow}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoText}>{line}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const PURPLE = '#8A2BE2';
const CYAN = '#00F0FF';

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#020205',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: 16,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 36,
    alignSelf: 'flex-start',
  },
  backText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  moduleBadge: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
    lineHeight: 44,
  },
  headingRule: {
    width: 64,
    height: 2,
    backgroundColor: PURPLE,
    marginTop: 14,
    borderRadius: 99,
    shadowColor: PURPLE,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },

  sectionLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  tierName: {
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  usageCount: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  barTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  barHint: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'right',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  featureText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
  },

  upgradeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  upgradeSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 17,
    marginBottom: 20,
  },
  ctaCyan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.3)',
    backgroundColor: 'rgba(0,240,255,0.06)',
  },
  ctaCyanText: {
    color: CYAN,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  ctaPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.3)',
    backgroundColor: 'rgba(138,43,226,0.06)',
  },
  ctaPurpleText: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  stripeHint: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 4,
    height: 4,
    borderRadius: 99,
    backgroundColor: PURPLE,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 19,
  },
});
