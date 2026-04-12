/**
 * app/(dashboard)/admin/users.tsx
 * VerAI - Identity Registry & Access Control
 * ----------------------------------------------------------------------------
 * MODULE OVERVIEW:
 * 1. AMBIENT ENGINE: Liquid Neon Orbs; 100% APK Touch-Safe (`pointerEvents: 'none'`).
 * 2. REAL-TIME SYNC: Listens to the 'profiles' table for instant registry updates.
 * 3. TIER-LESS ARCHITECTURE: Purged 'tier' dependency; relies strictly on 'role'.
 * 4. BAN MANAGEMENT: Custom ban durations + instant unban restores. Banned users stay visible.
 * 5. TOUCH FIXES: Strict input styling & keyboard tap persistence enabled.
 * ----------------------------------------------------------------------------
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
  AlertTriangle,
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
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

// ─── STRICT THEME ENFORCEMENT ───
const THEME = {
  obsidian: '#000012',
  danger: '#FF007F',
  success: '#32FF00',
  warning: '#F59E0B',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  slate: '#94a3b8',
};

// ─── STRICT INPUT FIX (Android Hover Bypass) ───
const strictInputStyle = {
  flex: 1,
  height: '100%',
  color: '#FFFFFF',
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
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

// ─── AMBIENT ORB ENGINE ───
const AmbientOrb = ({
  color,
  size,
  top,
  left,
  right,
  bottom,
  opacity = 0.05,
  delay = 0,
}: any) => {
  const { width, height } = Dimensions.get('window');
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, drift]);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, width * 0.1]) },
      { translateY: interpolate(drift.value, [0, 1], [0, height * 0.05]) },
      { scale: interpolate(drift.value, [0, 1], [0.9, 1.2]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity,
          top,
          left,
          right,
          bottom,
          pointerEvents: 'none',
        },
        anim,
      ]}
    />
  );
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
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
    if (Platform.OS !== 'web') {
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
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newValue as UserRole })
        .eq('id', selectedUser.id);
      if (error) throw error;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedUser((prev) =>
        prev ? { ...prev, role: newValue as UserRole } : null,
      );
      setUsers(
        users.map((u) =>
          u.id === selectedUser.id ? { ...u, role: newValue as UserRole } : u,
        ),
      );
      triggerHaptic('success');
    } catch (e: any) {
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
      setUsers(
        users.map((u) =>
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
      setUsers(
        users.map((u) =>
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
      setUsers(
        users.map((u) =>
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
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      triggerHaptic('success');
    } catch (e: any) {
      Alert.alert('Purge Failed', e.message);
    }
  };

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
                          : 'bg-white/5 border-white/10',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[8px] md:text-[9px] font-black uppercase tracking-widest',
                        item.role === 'admin'
                          ? 'text-[#8A2BE2]'
                          : item.role === 'premium'
                            ? 'text-[#F59E0B]'
                            : 'text-white/50',
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

          {/* Action Buttons */}
          <View className="flex-row flex-wrap items-center gap-2 pt-4 mt-4 border-t md:gap-3 border-white/5">
            <TouchableOpacity
              onPress={() => {
                setSelectedUser(item);
                setRoleModalVisible(true);
              }}
              className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-2.5 px-2 border border-white/5 bg-white/[0.03] rounded-xl hover:bg-white/10 active:scale-95"
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
              className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-2.5 px-2 border border-[#00F0FF]/20 bg-[#00F0FF]/10 rounded-xl hover:bg-[#00F0FF]/20 active:scale-95"
            >
              <PlusCircle size={14} color={THEME.cyan} />
              <Text className="text-[9px] md:text-[10px] font-black text-[#00F0FF] uppercase tracking-widest">
                +1K
              </Text>
            </TouchableOpacity>

            {isBanned ? (
              <TouchableOpacity
                onPress={() => executeUnban(item.id)}
                className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-2.5 px-2 border border-[#32FF00]/20 bg-[#32FF00]/10 rounded-xl hover:bg-[#32FF00]/20 active:scale-95"
              >
                <Unlock size={14} color={THEME.success} />
                <Text className="text-[9px] md:text-[10px] font-black text-[#32FF00] uppercase tracking-widest">
                  Restore
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setSelectedUser(item);
                  setBanModalVisible(true);
                }}
                className="flex-row items-center justify-center flex-1 min-w-[80px] md:min-w-[100px] gap-2 py-2.5 px-2 border border-white/5 bg-white/[0.03] rounded-xl hover:bg-white/10 active:scale-95"
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
              className="flex-row items-center justify-center w-12 md:flex-1 md:min-w-[100px] md:max-w-[140px] gap-2 py-2.5 px-2 border rounded-xl border-[#FF007F]/10 bg-[#FF007F]/5 hover:bg-[#FF007F]/10 ml-auto active:scale-95"
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

  return (
    <SafeAreaView className="flex-1 bg-[#000012]">
      <AmbientOrb
        color={THEME.cyan}
        size={400}
        top={-100}
        left={-150}
        opacity={0.04}
        delay={0}
      />
      <AmbientOrb
        color={THEME.purple}
        size={300}
        top={300}
        right={-100}
        opacity={0.05}
        delay={2000}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 w-full max-w-5xl mx-auto"
      >
        <View className="flex-col px-6 pt-6 pb-4 border-b border-white/5">
          <TouchableOpacity
            onPress={() => router.replace('/admin')}
            className="flex-row items-center mb-6 gap-x-3"
            activeOpacity={0.7}
            style={{ zIndex: 200, alignSelf: 'flex-start' }}
          >
            <ArrowBigLeftDash size={20} color={THEME.cyan} />
            <Text className="text-[11px] font-black tracking-[4px] text-[#00F0FF] uppercase">
              RETURN
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-3xl font-black tracking-tighter text-white uppercase"></Text>
              <Text className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-[2px] mt-1">
                {users.length} Active PID Logs
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => loadUsers(false)}
              className="items-center justify-center w-10 h-10 border rounded-2xl bg-[#00F0FF]/10 border-[#00F0FF]/20 active:scale-95"
            >
              <RefreshCcw size={16} color={THEME.cyan} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH INTERFACE FIX */}
        <View className="w-full max-w-4xl px-4 mx-auto mt-6 mb-6 md:px-6">
          <GlassCard className="flex-row items-center gap-3 px-5 border shadow-lg h-14 rounded-[20px] bg-white/[0.02] border-white/5 shadow-black/20">
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
              <TouchableOpacity onPress={() => setSearch('')}>
                <XCircle size={18} color={THEME.slate} opacity={0.5} />
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>

        {/* CRITICAL FIX: keyboardShouldPersistTaps="handled" */}
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={users.filter(
            (u) =>
              u.email.toLowerCase().includes(search.toLowerCase()) ||
              u.id.includes(search),
          )}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={{
            paddingHorizontal: isMobile ? 16 : 24,
            paddingBottom: 150,
          }}
          showsVerticalScrollIndicator={false}
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
              {['member', 'premium', 'support', 'admin'].map((role) => (
                <TouchableOpacity
                  key={`role-${role}`}
                  onPress={() => handleRoleUpdate(role)}
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
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setRoleModalVisible(false)}
              className="py-4 mt-2"
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
              className="flex-row items-center gap-4 p-5 mb-3 border bg-white/[0.02] border-white/10 rounded-2xl hover:bg-white/10"
            >
              <Clock size={18} color="#94a3b8" opacity={0.5} />
              <Text className="text-[10px] md:text-xs font-bold tracking-widest text-white/80 uppercase">
                24H TIMEOUT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => executeBan(7)}
              className="flex-row items-center gap-4 p-5 mb-3 border bg-white/[0.02] border-white/10 rounded-2xl hover:bg-white/10"
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
                className="items-center justify-center px-4 border h-14 bg-amber-500/10 border-amber-500/30 rounded-2xl"
              >
                <Text className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                  APPLY
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => executeBan(null)}
              className="flex-row items-center gap-4 p-5 mt-2 border bg-[#FF007F]/10 border-[#FF007F]/20 rounded-2xl hover:bg-[#FF007F]/20"
            >
              <Ban size={18} color={THEME.danger} opacity={0.8} />
              <Text className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-[#FF007F]">
                PERMANENT LOCK
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBanModalVisible(false)}
              className="py-4 mt-6"
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
              className="py-5 mb-4 border bg-[#FF007F]/10 border-[#FF007F]/30 rounded-3xl hover:bg-[#FF007F]/20 active:scale-95"
            >
              <Text className="text-[10px] md:text-xs font-black tracking-widest text-center uppercase text-[#FF007F]">
                Execute Purge
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteModalVisible(false)}
              className="py-4"
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
