/**
 * app/(dashboard)/admin/users.tsx
 * VeraxAI - User Panel
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE 
 *  ZERO-DROP TOUCH: keyboardShouldPersistTaps="always" + delayPressIn={0}.
 *  DATABASE SAFETY: Relies on the corrected 'Admin Power User' SQL policy.
 *  Native Web CSS overrides guarantee clean glassmorphism.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Platform,
  LayoutAnimation,
  UIManager,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Ban,
  UserCog,
  Trash2,
  Calendar,
  ShieldAlert,
  Mail,
  RefreshCcw,
  Coins,
  XCircle,
  Unlock,
  PlusCircle,
  KeyRound,
  Shield,
  CheckCircle2,
  Clock,
  ArrowBigLeftDash,
  AlertTriangle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect, Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
  useFrameCallback,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { supabase } from '../../../lib/supabase/client';
import { Database } from '../../../types/database/database.types';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';

// Enable Android Layout Animations
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── STRICT THEME ENFORCEMENT (Liquid Neon) ───
const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  danger: '#FF007F',
  success: '#32FF00',
  warning: '#F59E0B',
  purple: '#8A2BE2',
  member: '#3B82F6',
  slate: '#94a3b8',
  pink: '#FF007F',
  green: '#32FF00',
  red: '#FF3333',
};

const IS_WEB = Platform.OS === 'web';

const strictInputStyle = {
  flex: 1,
  height: '100%',
  color: '#FFFFFF',
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(IS_WEB ? { outlineStyle: 'none' } : {}),
} as any;

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

const WanderingCore = React.memo(
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
            key={index}
            color={color}
            delay={index * (baseDuration / waveCount)}
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

const AmbientArchitecture = React.memo(() => {
  const { width, height } = Dimensions.get('window');
  return (
    // STRICT TOUCH SAFETY: zIndex -1 and elevation -1 prevent UI blocking on Android
    <View
      style={[StyleSheet.absoluteFill, { zIndex: -1, elevation: -1 }]}
      pointerEvents="none"
    >
      <WanderingCore
        coreSize={14}
        color={THEME.cyan}
        maxWaveSize={width >= 1024 ? width * 0.8 : height * 1.0}
        waveCount={4}
        baseDuration={12000}
      />
    </View>
  );
});

const AnimatedBrowserIcon = React.memo(() => {
  const floatY = useSharedValue(0);
  const scanY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    scanY.value = withRepeat(
      withTiming(45, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: 100, height: 80, alignSelf: 'center', marginBottom: 12 },
        floatStyle,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 80">
        <Rect
          x="5"
          y="5"
          width="90"
          height="70"
          rx="8"
          fill="rgba(0, 240, 255, 0.05)"
          stroke={THEME.cyan}
          strokeWidth="2"
        />
        <Line
          x1="5"
          y1="20"
          x2="95"
          y2="20"
          stroke={THEME.cyan}
          strokeWidth="2"
        />
        <Circle cx="15" cy="12.5" r="2.5" fill={THEME.danger} />
        <Circle cx="25" cy="12.5" r="2.5" fill={THEME.warning} />
        <Circle cx="35" cy="12.5" r="2.5" fill={THEME.success} />
        <Rect
          x="15"
          y="32"
          width="40"
          height="6"
          rx="3"
          fill={THEME.purple}
          opacity="0.5"
        />
        <Rect
          x="15"
          y="46"
          width="70"
          height="6"
          rx="3"
          fill={THEME.cyan}
          opacity="0.3"
        />
        <Rect
          x="15"
          y="60"
          width="50"
          height="6"
          rx="3"
          fill={THEME.cyan}
          opacity="0.3"
        />
      </Svg>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 20,
            left: 10,
            width: 80,
            height: 2,
            backgroundColor: THEME.cyan,
            shadowColor: THEME.cyan,
            shadowOpacity: 1,
            shadowRadius: 5,
          },
          scanStyle,
        ]}
      />
    </Animated.View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: MASTER CONTROLLER & MUTATORS
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminUsersScreen() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [customBanDays, setCustomBanDays] = useState('');

  const loadUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data as UserProfile[]);
    } catch (e: any) {
      console.error('Fetch error:', e);
      Alert.alert('Error', 'Registry could not be synchronized.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const channelId = `admin_users_registry_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          loadUsers(true);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  const triggerHaptic = (type: 'selection' | 'success' | 'warning') => {
    if (!IS_WEB) {
      if (type === 'selection') Haptics.selectionAsync();
      if (type === 'success')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (type === 'warning')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleRoleUpdate = async (newValue: string) => {
    if (!selectedUser) return;
    triggerHaptic('selection');

    const cleanRole = newValue.trim().toLowerCase();

    try {
      const { error } = await supabase.rpc('admin_update_role' as any, {
        target_user_id: selectedUser.id,
        new_role: cleanRole,
      });

      if (error) throw error;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedUser((prev) =>
        prev ? { ...prev, role: cleanRole as UserRole } : null,
      );
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id ? { ...u, role: cleanRole as UserRole } : u,
        ),
      );

      setRoleModalVisible(false);
      triggerHaptic('success');
    } catch (e: any) {
      console.error('Role Update Error: ', e);
      Alert.alert('Update Failed', e.message);
    }
  };

  const handleAddTokens = async (
    amount: number,
    userId: string,
    currentBalance: number,
  ) => {
    triggerHaptic('success');
    try {
      const newBalance = currentBalance + amount;
      const { error } = await supabase
        .from('profiles')
        .update({ tokens_balance: newBalance })
        .eq('id', userId);
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, tokens_balance: newBalance } : u,
        ),
      );
    } catch (e: any) {
      Alert.alert('Transaction Failed', e.message);
    }
  };

  const executeBan = async (durationDays: number | null) => {
    if (!selectedUser) return;
    triggerHaptic('warning');
    setBanModalVisible(false);
    setCustomBanDays('');
    try {
      let bannedUntil = null;
      if (durationDays) {
        const date = new Date();
        date.setDate(date.getDate() + durationDays);
        bannedUntil = date.toISOString();
      } else {
        bannedUntil = '2099-12-31T23:59:59.000Z'; // Permanent Lock
      }
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'banned', banned_until: bannedUntil })
        .eq('id', selectedUser.id);
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === selectedUser.id
            ? { ...u, status: 'banned', banned_until: bannedUntil }
            : u,
        ),
      );
      triggerHaptic('success');
    } catch (e: any) {
      Alert.alert('Protocol Failed', e.message);
    }
  };

  const executeUnban = async (userId: string) => {
    triggerHaptic('success');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'active', banned_until: null })
        .eq('id', userId);
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, status: 'active', banned_until: null } : u,
        ),
      );
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    }
  };

  const executeDelete = async () => {
    if (!selectedUser) return;
    setDeleteModalVisible(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUsers((prevUsers) =>
        prevUsers.filter((u) => u.id !== selectedUser.id),
      );
      triggerHaptic('success');
    } catch (e: any) {
      Alert.alert('Purge Failed', e.message);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // MODULE 3: PREMIUM CARD RENDERER
  // ══════════════════════════════════════════════════════════════════════════════
  const renderUserCard = ({
    item,
    index,
  }: {
    item: UserProfile;
    index: number;
  }) => {
    const isBanned = item.status === 'banned' || item.banned_until !== null;
    const cardBgClass = isBanned
      ? 'bg-[#FF007F]/[0.05] border-[#FF007F]/30'
      : 'bg-white/[0.015] border-white/5';
    const joinDate = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <FadeIn delay={Math.min(index * 50, 500)}>
        <GlassCard
          className={cn(
            'p-5 md:p-6 mb-5 border rounded-3xl w-full max-w-4xl mx-auto overflow-hidden shadow-2xl',
            cardBgClass,
          )}
        >
          <View className="flex-row items-start gap-4 md:gap-5">
            <View
              className={cn(
                'items-center justify-center overflow-hidden border-2 rounded-full w-12 h-12 md:w-14 md:h-14 shrink-0',
                isBanned
                  ? 'bg-[#FF007F]/10 border-[#FF007F]/40'
                  : 'bg-[#00F0FF]/10 border-[#00F0FF]/30',
              )}
            >
              {item.avatar_url ? (
                <Image
                  source={{ uri: item.avatar_url }}
                  className="w-full h-full"
                />
              ) : (
                <Text
                  className={cn(
                    'text-lg md:text-xl font-black',
                    isBanned ? 'text-[#FF007F]' : 'text-[#00F0FF]',
                  )}
                >
                  {(item.full_name || item.email || 'U')[0].toUpperCase()}
                </Text>
              )}
            </View>

            <View className="flex-1">
              <View className="flex-row flex-wrap items-center justify-between gap-2 mb-1.5">
                <Text
                  className={cn(
                    'text-base md:text-lg font-bold text-white',
                    isBanned && 'line-through opacity-50',
                  )}
                >
                  {item.full_name || 'Anonymous Kernel'}
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {isBanned && (
                    <View className="px-2 py-0.5 rounded border bg-[#FF007F]/10 border-[#FF007F]/30">
                      <Text className="text-[8px] md:text-[9px] font-black uppercase text-[#FF007F] tracking-widest">
                        RESTRICTED
                      </Text>
                    </View>
                  )}
                  <View
                    className={cn(
                      'px-2 py-0.5 rounded border',
                      item.role === 'admin'
                        ? 'bg-[#8A2BE2]/20 border-[#8A2BE2]/50'
                        : item.role === 'premium'
                          ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30'
                          : item.role === 'support'
                            ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30'
                            : 'bg-[#3B82F6]/10 border-[#3B82F6]/30', // Electric Blue Member Tier
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[8px] md:text-[9px] font-black uppercase tracking-widest',
                        item.role === 'admin'
                          ? 'text-[#8A2BE2]'
                          : item.role === 'premium'
                            ? 'text-[#F59E0B]'
                            : item.role === 'support'
                              ? 'text-[#00F0FF]'
                              : 'text-[#3B82F6]',
                      )}
                    >
                      {item.role || 'MEMBER'}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="flex-row items-center gap-2 mb-3">
                <Mail size={12} color={THEME.slate} />
                <Text className="text-xs font-medium md:text-sm text-white/50">
                  {item.email}
                </Text>
              </View>

              <View className="flex-row flex-wrap items-center gap-x-4 md:gap-x-6 gap-y-2">
                <View className="flex-row items-center gap-1.5">
                  <Coins size={12} color={THEME.warning} />
                  <Text className="font-mono text-[10px] md:text-xs font-bold text-[#F59E0B]">
                    {item.tokens_balance.toLocaleString()} BAL
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <KeyRound
                    size={12}
                    color={item.custom_api_key ? THEME.success : THEME.cyan}
                    opacity={0.8}
                  />
                  <Text
                    className={cn(
                      'text-[9px] md:text-[10px] font-mono font-bold tracking-wider',
                      item.custom_api_key ? 'text-[#32FF00]' : 'text-[#00F0FF]',
                    )}
                  >
                    {item.custom_api_key ? '[BYO-KEY]' : '[SYSTEM]'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5 hidden md:flex">
                  <Calendar size={12} color={THEME.purple} />
                  <Text className="text-[9px] md:text-[10px] font-mono font-bold text-white/30 uppercase tracking-wider">
                    Joined {joinDate}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-2 pt-4 mt-4 border-t md:gap-3 border-white/5">
            <TouchableOpacity
              onPress={() => {
                setSelectedUser(item);
                setRoleModalVisible(true);
              }}
              delayPressIn={0}
              activeOpacity={0.7}
              className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-3 px-2 border border-white/5 bg-white/[0.02] rounded-xl hover:bg-white/[0.06]"
            >
              <UserCog size={14} color={THEME.cyan} />
              <Text className="text-[9px] md:text-[10px] font-black text-white/80 uppercase tracking-widest">
                Access
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                handleAddTokens(1000, item.id, item.tokens_balance)
              }
              delayPressIn={0}
              activeOpacity={0.7}
              className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-3 px-2 border border-[#00F0FF]/20 bg-[#00F0FF]/10 rounded-xl hover:bg-[#00F0FF]/20"
            >
              <PlusCircle size={14} color={THEME.cyan} />
              <Text className="text-[9px] md:text-[10px] font-black text-[#00F0FF] uppercase tracking-widest">
                +1K
              </Text>
            </TouchableOpacity>

            {isBanned ? (
              <TouchableOpacity
                onPress={() => executeUnban(item.id)}
                delayPressIn={0}
                activeOpacity={0.7}
                className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-3 px-2 border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded-xl hover:bg-[#F59E0B]/20"
              >
                <Unlock size={14} color={THEME.warning} />
                <Text className="text-[9px] md:text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                  Restore
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setSelectedUser(item);
                  setBanModalVisible(true);
                }}
                delayPressIn={0}
                activeOpacity={0.7}
                className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-3 px-2 border border-[#F59E0B]/20 bg-amber-500/5 rounded-xl hover:bg-amber-500/10"
              >
                <Ban size={14} color={THEME.warning} />
                <Text className="text-[9px] md:text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                  Restrict
                </Text>
              </TouchableOpacity>
            )}

            <View className="flex-[2] min-w-[10px] md:block hidden" />

            <TouchableOpacity
              onPress={() => {
                setSelectedUser(item);
                setDeleteModalVisible(true);
              }}
              delayPressIn={0}
              activeOpacity={0.7}
              className="flex-row items-center justify-center w-full md:flex-1 md:min-w-[100px] md:max-w-[140px] gap-2 py-3 px-2 border rounded-xl border-[#FF007F]/20 bg-[#FF007F]/5 hover:bg-[#FF007F]/10 ml-auto"
            >
              <Trash2 size={14} color={THEME.danger} opacity={0.8} />
              {!isMobile && (
                <Text className="text-[10px] font-black text-[#FF007F] uppercase tracking-widest">
                  Purge
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </FadeIn>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // MODULE 4: MASTER RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView className="flex-1 bg-[#000012]">
      {/* BACKGROUND ISOLATION */}
      <AmbientArchitecture />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 w-full max-w-5xl mx-auto"
      >
        {/* ── CENTRALIZED SVG HEADER ── */}
        <View className="relative flex-col items-center px-6 pt-6 pb-6 border-b md:px-8 border-white/5">
          <TouchableOpacity
            onPress={() => router.replace('/admin')}
            delayPressIn={0}
            activeOpacity={0.7}
            className="absolute z-50 p-2 transition-opacity left-6 top-8 hover:opacity-70"
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowBigLeftDash size={24} color={THEME.cyan} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => loadUsers(false)}
            delayPressIn={0}
            activeOpacity={0.7}
            className="absolute z-50 items-center justify-center w-10 h-10 border right-6 top-8 rounded-2xl bg-[#00F0FF]/10 border-[#00F0FF]/20 hover:bg-[#00F0FF]/20"
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <RefreshCcw size={16} color={THEME.cyan} />
          </TouchableOpacity>

          <AnimatedBrowserIcon />

          <Text className="mt-4 text-[10px] md:text-[11px] font-bold text-white/40 uppercase tracking-[3px] text-center">
            {users.length} Active User Profiles
          </Text>
        </View>

        <View className="w-full max-w-4xl px-4 mx-auto mt-6 mb-6 md:px-6">
          <GlassCard className="flex-row items-center gap-3 px-5 border shadow-lg h-14 rounded-[20px] bg-[#050A15] border-white/10 shadow-black/20">
            <Search size={18} color={THEME.slate} opacity={0.5} />
            <View className="justify-center flex-1 h-full">
              <TextInput
                style={strictInputStyle}
                placeholder="FILTER BY EMAIL OR UUID..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </View>
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} delayPressIn={0}>
                <XCircle size={18} color={THEME.slate} opacity={0.5} />
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>

        <FlatList
          keyboardShouldPersistTaps="always"
          style={
            IS_WEB
              ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
              : {}
          }
          showsVerticalScrollIndicator={false}
          data={users.filter(
            (u) =>
              u.email.toLowerCase().includes(search.toLowerCase()) ||
              u.id.includes(search),
          )}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={{
            paddingHorizontal: isMobile ? 16 : 32,
            paddingBottom: 150,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadUsers(true)}
              tintColor={THEME.cyan}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 opacity-30">
              <ShieldAlert size={48} color="#fff" />
              <Text className="mt-4 text-[10px] md:text-xs font-black text-white uppercase tracking-[4px]">
                No Matching Profiles
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* ════════ ADMIN MODALS ════════ */}
      <Modal visible={roleModalVisible} transparent animationType="slide">
        <View className="items-center justify-center flex-1 p-6 bg-[#000012]/90">
          <GlassCard className="w-full max-w-md p-8 border bg-[#050A15] border-[#00F0FF]/20 rounded-[40px] shadow-2xl shadow-cyan-900/20">
            <View className="items-center mb-8">
              <View className="items-center justify-center w-16 h-16 mb-4 border rounded-3xl bg-[#00F0FF]/10 border-[#00F0FF]/20">
                <Shield size={32} color={THEME.cyan} />
              </View>
              <Text className="text-xl font-black tracking-widest text-center text-white uppercase">
                Modify Identity
              </Text>
              <Text className="mt-2 text-[10px] text-white/50 text-center uppercase tracking-widest leading-4">
                {selectedUser?.email}
              </Text>
            </View>

            <Text className="mb-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-center">
              System Role
            </Text>
            <View className="flex-row flex-wrap justify-center gap-3 mb-8">
              {(['member', 'premium', 'support', 'admin'] as UserRole[]).map(
                (role) => (
                  <TouchableOpacity
                    key={`role-${role}`}
                    onPress={() => handleRoleUpdate(role)}
                    delayPressIn={0}
                    className={cn(
                      'px-4 py-3 border rounded-xl flex-row items-center gap-2 transition-all',
                      selectedUser?.role === role
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40'
                        : 'bg-white/[0.02] border-white/10 hover:bg-white/10',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[10px] font-black tracking-widest uppercase',
                        selectedUser?.role === role
                          ? 'text-[#00F0FF]'
                          : 'text-white/60',
                      )}
                    >
                      {role}
                    </Text>
                    {selectedUser?.role === role && (
                      <CheckCircle2 size={12} color={THEME.cyan} />
                    )}
                  </TouchableOpacity>
                ),
              )}
            </View>
            <TouchableOpacity
              onPress={() => setRoleModalVisible(false)}
              delayPressIn={0}
              className="py-4 mt-2 active:opacity-50"
            >
              <Text className="text-center font-black text-white/30 uppercase tracking-[4px] text-[10px]">
                Close Panel
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={banModalVisible} transparent animationType="fade">
        <View className="items-center justify-center flex-1 p-6 bg-[#000012]/95">
          <GlassCard className="w-full max-w-sm p-8 border bg-[#050A15] border-white/10 rounded-[40px] shadow-2xl shadow-black">
            <View className="items-center mb-6">
              <ShieldAlert size={40} color={THEME.warning} />
              <Text className="mt-4 text-xl font-black tracking-widest text-white uppercase">
                Restrict PID
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => executeBan(1)}
              delayPressIn={0}
              className="flex-row items-center gap-4 p-5 mb-3 border bg-white/[0.02] border-white/10 rounded-2xl hover:bg-white/10 active:scale-95"
            >
              <Clock size={18} color="#94a3b8" opacity={0.5} />
              <Text className="text-[10px] md:text-xs font-bold tracking-widest text-white/80 uppercase">
                24H TIMEOUT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => executeBan(7)}
              delayPressIn={0}
              className="flex-row items-center gap-4 p-5 mb-3 border bg-white/[0.02] border-white/10 rounded-2xl hover:bg-white/10 active:scale-95"
            >
              <Calendar size={18} color="#94a3b8" opacity={0.5} />
              <Text className="text-[10px] md:text-xs font-bold tracking-widest text-white/80 uppercase">
                7 DAY SUSPENSION
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 mb-3">
              <View className="justify-center flex-1 px-4 border h-14 rounded-2xl bg-white/[0.02] border-white/10 focus-within:border-amber-500">
                <TextInput
                  style={strictInputStyle}
                  placeholder="Custom Days"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  value={customBanDays}
                  onChangeText={setCustomBanDays}
                />
              </View>
              <TouchableOpacity
                onPress={() => executeBan(parseInt(customBanDays) || 30)}
                delayPressIn={0}
                className="items-center justify-center px-4 border h-14 bg-amber-500/10 border-amber-500/30 rounded-2xl active:scale-95"
              >
                <Text className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                  APPLY
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => executeBan(null)}
              delayPressIn={0}
              className="flex-row items-center gap-4 p-5 mt-2 border bg-[#FF007F]/10 border-[#FF007F]/20 rounded-2xl hover:bg-[#FF007F]/20 active:scale-95"
            >
              <Ban size={18} color={THEME.danger} opacity={0.8} />
              <Text className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-[#FF007F]">
                PERMANENT LOCK
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBanModalVisible(false)}
              delayPressIn={0}
              className="py-4 mt-6 active:opacity-50"
            >
              <Text className="text-center font-black text-white/30 uppercase tracking-[4px] text-[10px]">
                Abort
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="slide">
        <View className="items-center justify-center flex-1 p-6 bg-[#000012]/95">
          <GlassCard className="w-full max-w-sm p-10 border bg-[#050A15] border-[#FF007F]/20 rounded-[50px] shadow-2xl shadow-pink-900/20">
            <View className="items-center mb-8">
              <AlertTriangle size={64} color={THEME.danger} />
              <Text className="mt-6 text-2xl font-black tracking-tighter text-center text-white uppercase">
                Critical Purge
              </Text>
              <Text className="mt-4 text-[10px] md:text-xs leading-5 tracking-widest text-center uppercase text-white/40">
                Are you certain? Deleting{' '}
                <Text className="font-bold text-white">
                  {selectedUser?.email}
                </Text>{' '}
                is an irreversible database transaction.
              </Text>
            </View>
            <TouchableOpacity
              onPress={executeDelete}
              delayPressIn={0}
              className="py-5 mb-4 border bg-[#FF007F]/10 border-[#FF007F]/30 rounded-3xl hover:bg-[#FF007F]/20 active:scale-95"
            >
              <Text className="text-[10px] md:text-xs font-black tracking-widest text-center uppercase text-[#FF007F]">
                Execute Purge
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteModalVisible(false)}
              delayPressIn={0}
              className="py-4 active:opacity-50"
            >
              <Text className="text-center font-black text-white/30 uppercase tracking-[4px] text-[10px]">
                Cancel Transaction
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
