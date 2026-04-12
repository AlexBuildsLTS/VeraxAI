/**
 * app/(dashboard)/admin/keys.tsx
 * VeraxAI — Enterprise API Key Vault & Token Analytics
 * ----------------------------------------------------------------------------
 * This dashboard allows Root Admins to securely inject fallback API keys into
 * the database, monitor their health, and visualize daily AI token expenditure.
 * ----------------------------------------------------------------------------
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react-native';
import { supabase } from '../../../lib/supabase/client';
import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';

// ─── THEME CONSTANTS ───
const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  danger: '#FF007F',
  success: '#32FF00',
  slate: '#94a3b8',
};

// ─── STRICT INPUT FIX FOR ANDROID ───
const strictInputStyle = {
  flex: 1,
  color: '#FFFFFF',
  fontSize: 14,
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
} as any;

// ─── TYPES ───
type SystemKey = {
  id: string;
  name: string;
  key_preview: string;
  status: string;
  tokens_burned: number;
};

type DailyUsage = {
  usage_date: string;
  total_tokens: number;
  total_requests: number;
};

export default function ApiKeysDashboard() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  const [keys, setKeys] = useState<SystemKey[]>([]);
  const [chartData, setChartData] = useState<DailyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
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

      const { data: usageData, error: usageError } = await supabase.rpc(
        'get_daily_token_usage',
        { days_back: 7 },
      );

      if (usageError) throw usageError;
      if (usageData) setChartData(usageData as DailyUsage[]);
    } catch (err: any) {
      console.error('[Admin API Vault Error]', err);
      Alert.alert('System Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyName || newKeyValue.length < 10) {
      Alert.alert('Protocol Error', 'Valid alias and API key required.');
      return;
    }

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

  // Safe fallback to 1 to avoid division by zero
  const maxTokens = Math.max(
    ...chartData.map((d) => Number(d.total_tokens)),
    1,
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
          {/* ─── NEW FLUID IMAGE HEADER (Perfectly Centered) ─── */}
          <FadeIn delay={100} className="w-full mb-10">
            <View className="relative flex-row items-center justify-center w-full h-16 mb-2">
              {/* Back Button (Absolute Left) */}
              <TouchableOpacity
                onPress={() => router.replace('/admin')}
                className="absolute left-0 z-50 flex-row items-center py-2 gap-x-2 active:scale-95"
                activeOpacity={0.7}
              >
                <ArrowBigLeftDash size={20} color={THEME.cyan} />
                <Text className="text-[11px] font-black tracking-[4px] text-[#00F0FF] uppercase hidden md:flex">
                  RETURN
                </Text>
              </TouchableOpacity>

              {/* Center Image Icon */}
              <View className="items-center justify-center pointer-events-none">
                <Image
                  source={require('../../../assets/api128.png')}
                  style={{ width: 64, height: 64 }}
                  resizeMode="contain"
                />
              </View>

              {/* Refresh Button (Absolute Right) */}
              <TouchableOpacity
                onPress={() => fetchDashboardData()}
                className="absolute right-0 z-50 items-center justify-center w-10 h-10 border rounded-2xl bg-[#00F0FF]/10 border-[#00F0FF]/20 active:scale-95"
              >
                <RefreshCcw size={16} color={THEME.cyan} />
              </TouchableOpacity>
            </View>

            {/* Active Nodes Subtitle */}
            <View className="items-center justify-center w-full mt-2">
              <Text className="text-[9px] md:text-[12px] font-bold text-green-400/40 uppercase tracking-[2px]">
                {keys.length} API KEYS
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
              {/* ─── MODULE 1: TOKEN BURN CHART ─── */}
              <FadeIn delay={200}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center gap-x-3">
                      <Activity size={24} color={THEME.danger} />
                      <Text className="text-base font-black tracking-widest text-white uppercase">
                        Token Burn (7 Days)
                      </Text>
                    </View>
                  </View>

                  {/* FIXED CHART: justify-around prevents crushing, specific widths preserve the bars */}
                  <View className="flex-row items-end justify-around h-48 pb-2 border-b border-white/10">
                    {chartData.map((data, idx) => {
                      const tokenCount = Number(data.total_tokens);
                      // Max bar height is 140px inside the 192px container to leave room for the tooltip
                      const calculatedHeight =
                        maxTokens > 0 ? (tokenCount / maxTokens) * 140 : 0;
                      const finalHeight = Math.max(
                        calculatedHeight,
                        tokenCount > 0 ? 4 : 0,
                      );
                      const dayName = new Date(
                        data.usage_date,
                      ).toLocaleDateString('en-US', { weekday: 'short' });

                      return (
                        <View key={idx} className="items-center w-10 md:w-16">
                          <View className="items-center justify-end w-full h-full group">
                            <View
                              className="w-5 md:w-8 bg-[#FF007F]/80 rounded-t-sm"
                              style={{ height: finalHeight }}
                            />
                            {/* Tooltip Overlay */}
                            <View className="absolute inset-0 z-10 items-center justify-end pb-8 transition-opacity opacity-0 hover:opacity-100">
                              <View className="px-2 py-1 mb-2 border rounded pointer-events-none bg-black/90 border-white/10">
                                <Text className="text-[9px] text-white font-mono whitespace-nowrap">
                                  {tokenCount} T
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Text className="text-[9px] text-white/40 mt-3 uppercase tracking-wider">
                            {dayName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </GlassCard>
              </FadeIn>

              {/* ─── MODULE 2: SYSTEM FALLBACK KEYS ─── */}
              <FadeIn delay={300}>
                <GlassCard className="p-6 md:p-8 mb-8 border bg-white/[0.015] border-white/5 rounded-3xl md:rounded-[32px]">
                  <View className="flex-row items-center mb-8 gap-x-3">
                    <ShieldCheck size={24} color={THEME.success} />
                    <Text className="text-base font-black tracking-widest text-white uppercase">
                      Cascading Fallback Matrix
                    </Text>
                  </View>

                  {/* Add Key Form - Stacked on Mobile, Row on Desktop */}
                  <View className="z-50 flex-col gap-4 mb-10 md:flex-row">
                    <View className="flex-1 h-14 border bg-black/40 border-white/10 rounded-[20px] px-5 focus-within:border-[#00F0FF] justify-center">
                      <TextInput
                        value={newKeyName}
                        onChangeText={setNewKeyName}
                        placeholder="Alias (e.g., Gemini-Backup-1)"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={strictInputStyle}
                      />
                    </View>
                    <View className="flex-[2] h-14 border bg-black/40 border-white/10 rounded-[20px] px-5 focus-within:border-[#00F0FF] justify-center">
                      <TextInput
                        value={newKeyValue}
                        onChangeText={setNewKeyValue}
                        secureTextEntry
                        placeholder="API Key (AIzaSy...)"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={strictInputStyle}
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

                  {/* Active Keys List */}
                  <View className="gap-y-3">
                    <View className="flex-row items-center hidden px-4 mb-2 md:flex">
                      <Text className="flex-[2] text-[9px] text-white/30 tracking-[2px] uppercase">
                        Alias
                      </Text>
                      <Text className="flex-[2] text-[9px] text-white/30 tracking-[2px] uppercase">
                        Preview
                      </Text>
                      <Text className="flex-1 text-[9px] text-white/30 tracking-[2px] uppercase text-right">
                        Tokens Burned
                      </Text>
                      <View className="w-10" />
                    </View>

                    {keys.length === 0 ? (
                      <View className="items-center justify-center py-10 border border-dashed border-white/10 rounded-[20px]">
                        <Text className="text-xs tracking-widest uppercase text-white/40">
                          No fallback keys registered.
                        </Text>
                      </View>
                    ) : (
                      keys.map((key) => (
                        <View
                          key={key.id}
                          className="flex-col md:flex-row items-start md:items-center px-5 py-4 gap-y-3 md:gap-y-0 bg-black/40 border border-white/5 rounded-2xl md:rounded-[16px]"
                        >
                          <View className="flex-[2] flex-row items-center gap-x-3 w-full md:w-auto">
                            <View
                              className={`w-2 h-2 rounded-full ${key.status === 'active' ? 'bg-[#32FF00]' : 'bg-[#FF007F]'} shadow-[0_0_8px_${key.status === 'active' ? '#32FF00' : '#FF007F'}]`}
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
                              {Number(key.tokens_burned || 0).toLocaleString()}
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
                      ))
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
