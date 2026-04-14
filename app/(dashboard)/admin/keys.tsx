/**
 * app/(dashboard)/admin/keys.tsx
 * VeraxAI — Enterprise API Key Vault & Telemetry Analytics
 * ----------------------------------------------------------------------------
 * MODULE OVERVIEW:
 *  MULTI-LINE VELOCITY: Top chart tracks 7D velocity using native SVG lines.
 *  DYNAMIC HOVERS: Interactive Web/APK overlays with exact token isolation.
 * ----------------------------------------------------------------------------
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
  Pressable,
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
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase } from '../../../lib/supabase/client';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';

// ─── CONFIGURATION: API KEY COLORS ───────────────────────────────────────────
const KEY_COLORS: Record<string, string> = {
  ENV_MASTER: '#00F0FF', // Neon Cyan
  GEMINIAPI_KEY_1: '#FF007F', // Neon Pink
  GEMINIAPI_KEY_2: '#32FF00', // Neon Green
  GEMINIAPI_KEY_3: '#8A2BE2', // Electric Purple
  GEMINIAPI_KEY_4: '#F59E0B', // Warning Amber
};

const getColorForKey = (keyName: string) => {
  if (KEY_COLORS[keyName]) return KEY_COLORS[keyName];
  let hash = 0;
  for (let i = 0; i < keyName.length; i++)
    hash = keyName.charCodeAt(i) + ((hash << 5) - hash);
  const fallbackColors = [
    '#3B82F6',
    '#EC4899',
    '#10B981',
    '#F59E0B',
    '#6366F1',
  ];
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  danger: '#FF007F',
  success: '#32FF00',
  purple: '#8A2BE2',
};

const strictInputStyle = {
  flex: 1,
  color: '#FFFFFF',
  fontSize: 14,
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
} as any;

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
type SystemKey = {
  id: string;
  name: string;
  key_preview: string;
  status: string;
  tokens_burned: number;
};
type RawLog = {
  tokens_consumed: number;
  created_at: string;
  metadata: { api_key_name: string };
};

type ChartDataPoint = {
  label: string;
  fullDate: string;
  total: number;
  breakdown: { keyName: string; tokens: number; color: string }[];
};

// ─── TIMELINE GENERATORS (Strict JS Parsing) ─────────────────────────────────

const buildDailyData = (logs: RawLog[]): ChartDataPoint[] => {
  const bins = [];
  const today = new Date();

  // 7 Days back, chronological
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
      keyMap[keyName] = (keyMap[keyName] || 0) + log.tokens_consumed;
      total += log.tokens_consumed;
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

  // STRICT REQUIREMENT: Jan -> Dec of current calendar year
  for (let i = 0; i < 12; i++) {
    const monthPrefix = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    const label = monthsArr[i];
    const fullDate = `${label} ${currentYear}`;
    bins.push({ label, fullDate, prefix: monthPrefix });
  }

  return bins.map((bin) => {
    const binLogs = logs.filter((log) => log.created_at.startsWith(bin.prefix));
    const keyMap: Record<string, number> = {};
    let total = 0;

    binLogs.forEach((log) => {
      const keyName = log.metadata?.api_key_name || 'UNKNOWN_KEY';
      keyMap[keyName] = (keyMap[keyName] || 0) + log.tokens_consumed;
      total += log.tokens_consumed;
    });

    const breakdown = Object.keys(keyMap).map((keyName) => ({
      keyName,
      tokens: keyMap[keyName],
      color: getColorForKey(keyName),
    }));

    return { label: bin.label, fullDate: bin.fullDate, total, breakdown };
  });
};

// ─── MODULE 1: MULTI-LINE SVG CHART ──────────────────────────────────────────
const SvgMultiLineChart = ({
  data,
  allUniqueKeys,
  hiddenKeys,
  selectedIndex,
  setSelectedIndex,
}: {
  data: ChartDataPoint[];
  allUniqueKeys: Set<string>;
  hiddenKeys: Set<string>;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
}) => {
  const VIEWBOX_W = 1000;
  const VIEWBOX_H = 200;
  const PADDING_Y = 20;
  const PADDING_X = 20;

  const activeKeys = Array.from(allUniqueKeys).filter(
    (k) => !hiddenKeys.has(k),
  );

  // Max value calculation for scaling the lines perfectly
  const maxVal = Math.max(
    ...data.flatMap((d) =>
      d.breakdown
        .filter((b) => !hiddenKeys.has(b.keyName))
        .map((b) => b.tokens),
    ),
    10,
  );

  return (
    <View className="relative w-full h-full">
      <View className="absolute inset-0 flex-col justify-between py-[10%]">
        <View className="w-full h-px bg-white/5" />
        <View className="w-full h-px bg-white/5" />
        <View className="w-full h-px bg-white/5" />
      </View>

      <View className="absolute inset-0 pointer-events-none">
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="none"
        >
          {activeKeys.map((keyName, keyIdx) => {
            const color = getColorForKey(keyName);

            const points = data.map((d, i) => {
              const b = d.breakdown.find((x) => x.keyName === keyName);
              const val = b ? b.tokens : 0;
              const x =
                PADDING_X +
                (i / (data.length - 1)) * (VIEWBOX_W - PADDING_X * 2);
              const y =
                VIEWBOX_H -
                PADDING_Y -
                (val / maxVal) * (VIEWBOX_H - PADDING_Y * 2);
              return { x, y, val };
            });

            const dStr = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

            return (
              <React.Fragment key={keyName}>
                <Path
                  d={dStr}
                  stroke={color}
                  strokeWidth={3}
                  fill="none"
                  opacity={0.8}
                />
                {points.map((p, i) => (
                  <Circle
                    key={`dot-${keyIdx}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={i === selectedIndex ? 6 : 4}
                    fill={THEME.obsidian}
                    stroke={color}
                    strokeWidth={2}
                    opacity={p.val > 0 || i === selectedIndex ? 1 : 0}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      <View className="absolute inset-0 flex-row">
        {data.map((point, idx) => {
          const hoverProps = Platform.select({
            web: { onMouseEnter: () => setSelectedIndex(idx) },
            default: { onPress: () => setSelectedIndex(idx) },
          });

          return (
            <Pressable
              key={idx}
              {...hoverProps}
              className="items-center justify-end flex-1 h-full"
            >
              <View
                className={`w-full h-full bg-white transition-opacity duration-200 ${selectedIndex === idx ? 'opacity-5' : 'opacity-0'}`}
              />
              <Text
                className={`absolute bottom-[-24px] text-[9px] uppercase tracking-wider ${selectedIndex === idx ? 'text-white font-bold' : 'text-white/30'}`}
              >
                {point.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ─── MODULE 2: ANIMATED STACKED BAR CHART ────────────────────────────────────
const AnimatedStackedBar = ({
  dataPoint,
  maxVisibleTotal,
  maxHeight,
  isSelected,
  onInteract,
  hiddenKeys,
}: {
  dataPoint: ChartDataPoint;
  maxVisibleTotal: number;
  maxHeight: number;
  isSelected: boolean;
  onInteract: () => void;
  hiddenKeys: Set<string>;
}) => {
  const visibleTotal = useMemo(() => {
    return dataPoint.breakdown.reduce(
      (sum, b) => (hiddenKeys.has(b.keyName) ? sum : sum + b.tokens),
      0,
    );
  }, [dataPoint, hiddenKeys]);

  const animatedStyle = useAnimatedStyle(() => {
    const targetHeight =
      maxVisibleTotal > 0 ? (visibleTotal / maxVisibleTotal) * maxHeight : 0;
    const finalHeight = Math.max(targetHeight, visibleTotal > 0 ? 4 : 0);
    return {
      height: withSpring(finalHeight, { damping: 15, stiffness: 90 }),
      opacity: withTiming(isSelected ? 1 : 0.6, { duration: 150 }),
    };
  });

  const hoverProps = Platform.select({
    web: { onMouseEnter: onInteract },
    default: { onPress: onInteract },
  });

  return (
    <View className="items-center justify-end flex-1 h-full mx-1 max-w-[48px]">
      <Pressable
        {...hoverProps}
        className="items-center justify-end w-full h-full"
      >
        <View className="absolute bottom-0 w-full h-full bg-white/[0.02] rounded-md border border-white/[0.05]" />
        <Animated.View
          style={[
            animatedStyle,
            {
              width: '100%',
              borderRadius: 6,
              overflow: 'hidden',
              justifyContent: 'flex-end',
              zIndex: 10,
            },
          ]}
        >
          {dataPoint.breakdown.map((segment, idx) => {
            const isHidden = hiddenKeys.has(segment.keyName);
            const segmentHeightPct =
              isHidden || visibleTotal === 0
                ? 0
                : (segment.tokens / visibleTotal) * 100;
            return (
              <Animated.View
                key={idx}
                style={useAnimatedStyle(() => ({
                  height: withSpring(`${segmentHeightPct}%`),
                  width: '100%',
                  backgroundColor: segment.color,
                  opacity: withTiming(isHidden ? 0 : 1),
                }))}
              />
            );
          })}
        </Animated.View>
        <Text
          className={`text-[8px] md:text-[10px] uppercase tracking-wider mt-4 ${
            isSelected ? 'text-white font-bold' : 'text-white/30'
          }`}
          numberOfLines={1}
        >
          {dataPoint.label}
        </Text>
      </Pressable>
    </View>
  );
};

// ─── MAIN DASHBOARD COMPONENT ────────────────────────────────────────────────
export default function ApiKeysDashboard() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  const [keys, setKeys] = useState<SystemKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dailyData, setDailyData] = useState<ChartDataPoint[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartDataPoint[]>([]);
  const [allUniqueKeys, setAllUniqueKeys] = useState<Set<string>>(new Set());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  // Default selections: Today for Daily, Current Month for Monthly
  const [selectedDailyIdx, setSelectedDailyIdx] = useState<number>(6);
  const [selectedMonthlyIdx, setSelectedMonthlyIdx] = useState<number>(
    new Date().getMonth(),
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
      if (keyData) setKeys(keyData as SystemKey[]);

      // Fetch all telemetry data for the current calendar year
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
      console.error('[Admin Analytics Error]', err);
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

  const maxMonthly = Math.max(
    ...monthlyData.map((d) =>
      d.breakdown.reduce(
        (sum, b) => (hiddenKeys.has(b.keyName) ? sum : sum + b.tokens),
        0,
      ),
    ),
    10,
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

  const ChartLegend = () => (
    <View className="flex-row flex-wrap items-center gap-4 pt-6 mt-6 border-t border-white/5">
      {Array.from(allUniqueKeys).map((keyName) => {
        const isHidden = hiddenKeys.has(keyName);
        const keyColor = getColorForKey(keyName);
        return (
          <TouchableOpacity
            key={keyName}
            onPress={() => toggleKeyVisibility(keyName)}
            activeOpacity={0.7}
            className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${isHidden ? 'border-white/10 bg-white/5' : 'border-white/20 bg-white/10'}`}
          >
            <View
              style={{ backgroundColor: isHidden ? '#333' : keyColor }}
              className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px] shadow-black"
            />
            <Text
              className={`text-xs font-mono transition-opacity ${isHidden ? 'text-white/30 line-through' : 'text-white/90'}`}
            >
              {keyName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const activeDailyPoint = dailyData[selectedDailyIdx];
  const activeMonthlyPoint = monthlyData[selectedMonthlyIdx];

  // Helper to isolate only the tokens of the VISIBLE keys
  const getVisibleTotal = (point: ChartDataPoint) =>
    point.breakdown.reduce(
      (sum, b) => (hiddenKeys.has(b.keyName) ? sum : sum + b.tokens),
      0,
    );

  return (
    <SafeAreaView className="flex-1 bg-[#000012]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
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
          {/* ─── HEADER ─── */}
          <FadeIn delay={100} className="w-full mb-10">
            <View className="relative flex-row items-center justify-center w-full h-16 mb-2">
              <TouchableOpacity
                onPress={() => router.replace('/admin')}
                className="absolute left-0 z-50 flex-row items-center py-2 gap-x-2 active:scale-95"
              >
                <ArrowBigLeftDash size={20} color={THEME.cyan} />
                <Text className="text-[11px] font-black tracking-[4px] text-[#00F0FF] uppercase hidden md:flex">
                  RETURN
                </Text>
              </TouchableOpacity>
              <View className="items-center justify-center pointer-events-none">
                <Image
                  source={require('../../../assets/api128.png')}
                  style={{ width: 64, height: 64 }}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                onPress={fetchDashboardData}
                className="absolute right-0 z-50 items-center justify-center w-10 h-10 border rounded-2xl bg-[#00F0FF]/10 border-[#00F0FF]/20 active:scale-95"
              >
                <RefreshCcw size={16} color={THEME.cyan} />
              </TouchableOpacity>
            </View>
            <View className="items-center justify-center w-full mt-2">
              <Text className="text-[9px] md:text-[12px] font-bold text-[#00F0FF]/60 uppercase tracking-[2px]">
                {keys.length} FALLBACK NODES
              </Text>
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
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center gap-x-3">
                      <Activity size={24} color={THEME.danger} />
                      <Text className="text-base font-black tracking-widest text-white uppercase">
                        Network Velocity (7D)
                      </Text>
                    </View>
                  </View>

                  <View className="h-56 pb-8 md:h-64">
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

                  {/* DYNAMIC HOVER HUD (DAILY) */}
                  <View className="justify-end h-28">
                    {activeDailyPoint &&
                    getVisibleTotal(activeDailyPoint) > 0 ? (
                      <View className="p-4 mt-6 border border-white/10 rounded-2xl bg-white/5">
                        <Text className="text-[#00F0FF] text-[10px] font-black uppercase tracking-widest mb-3">
                          Token Burn: {activeDailyPoint.fullDate}
                        </Text>
                        <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                          {activeDailyPoint.breakdown
                            .filter((b) => !hiddenKeys.has(b.keyName))
                            .map((b, idx) => (
                              <View
                                key={idx}
                                className="flex-row items-center gap-x-2"
                              >
                                <View
                                  style={{ backgroundColor: b.color }}
                                  className="w-2.5 h-2.5 rounded-full"
                                />
                                <Text className="font-mono text-xs text-white/70">
                                  {b.keyName}:
                                </Text>
                                <Text className="text-xs font-bold tracking-widest text-white">
                                  {b.tokens.toLocaleString()}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    ) : (
                      <View className="items-center justify-center p-4 mt-6 bg-transparent border border-transparent rounded-2xl">
                        <Text className="font-mono text-xs tracking-widest uppercase text-white/20">
                          No telemetry for this date
                        </Text>
                      </View>
                    )}
                  </View>
                  <ChartLegend />
                </GlassCard>
              </FadeIn>

              {/* ─── MODULE 2: MONTHLY VOLUME CHART (JAN -> DEC STACKED BARS) ─── */}
              <FadeIn delay={300}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center gap-x-3">
                      <BarChart2 size={24} color={THEME.purple} />
                      <Text className="text-base font-black tracking-widest text-white uppercase">
                        Volume Aggregation (12M)
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-end justify-between h-56 px-1 pb-8 md:h-64 md:px-4">
                    {monthlyData.map((point, idx) => (
                      <AnimatedStackedBar
                        key={`monthly-${idx}`}
                        dataPoint={point}
                        maxVisibleTotal={maxMonthly}
                        maxHeight={180}
                        isSelected={selectedMonthlyIdx === idx}
                        onInteract={() => setSelectedMonthlyIdx(idx)}
                        hiddenKeys={hiddenKeys}
                      />
                    ))}
                  </View>

                  {/* DYNAMIC HOVER HUD (MONTHLY) */}
                  <View className="justify-end h-28">
                    {activeMonthlyPoint &&
                    getVisibleTotal(activeMonthlyPoint) > 0 ? (
                      <View className="p-4 mt-6 border border-white/10 rounded-2xl bg-white/5">
                        <Text className="text-[#8A2BE2] text-[10px] font-black uppercase tracking-widest mb-3">
                          Total Volume: {activeMonthlyPoint.fullDate}
                        </Text>
                        <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                          {activeMonthlyPoint.breakdown
                            .filter((b) => !hiddenKeys.has(b.keyName))
                            .map((b, idx) => (
                              <View
                                key={idx}
                                className="flex-row items-center gap-x-2"
                              >
                                <View
                                  style={{ backgroundColor: b.color }}
                                  className="w-2.5 h-2.5 rounded-full"
                                />
                                <Text className="font-mono text-xs text-white/70">
                                  {b.keyName}:
                                </Text>
                                <Text className="text-xs font-bold tracking-widest text-white">
                                  {b.tokens.toLocaleString()}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    ) : (
                      <View className="items-center justify-center p-4 mt-6 bg-transparent border border-transparent rounded-2xl">
                        <Text className="font-mono text-xs tracking-widest uppercase text-white/20">
                          No volume for this month
                        </Text>
                      </View>
                    )}
                  </View>
                  <ChartLegend />
                </GlassCard>
              </FadeIn>

              {/* ─── MODULE 3: SYSTEM FALLBACK KEYS VAULT ─── */}
              <FadeIn delay={400}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center mb-8 gap-x-3">
                    <ShieldCheck size={24} color={THEME.success} />
                    <Text className="text-base font-black tracking-widest text-white uppercase">
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
                        textContentType="none"
                        importantForAutofill="no"
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
                        textContentType="none"
                        importantForAutofill="no"
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
