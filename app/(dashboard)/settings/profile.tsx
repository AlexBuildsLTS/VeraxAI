/**
 * app/(dashboard)/settings/profile.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * User Profile Management — Identity data, avatar sync, and account metrics.
 * Architecture: 2026 High-Performance Standards (Web Vercel & Native APK)
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL:
 * 1. NEBULA AMBIENT ENGINE: Parity with settings/index. 120fps UI-thread physics.
 * 2. BIOMETRIC SVG MATRIX: High-fidelity, multi-layered rotating SVG identity core.
 * 3. TOUCH SAFETY: pointerEvents="none" strictly enforced on all ambient layers.
 * 4. DOM SAFETY: Strict ternary logic (?:) used to prevent empty string text node crashes.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { memo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── ICONS ───────────────────────────────────────────────────────────────────
import {
  ArrowBigLeftDash,
  ArrowBigUpDash,
  User,
  Mail,
  Sparkles,
  Shield,
  Globe,
  Pencil,
  RotateCcw,
  Upload,
} from 'lucide-react-native';

// ─── SYSTEM COMPONENTS ───────────────────────────────────────────────────────
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase/client';

// ─── ANIMATION ENGINE & SVG ──────────────────────────────────────────────────
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  withDelay,
  withSpring,
  Easing,
  useFrameCallback,
} from 'react-native-reanimated';

// ─── THEME CONSTANTS ─────────────────────────────────────────────────────────
const THEME = {
  obsidian: '#000012',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#32FF00',
};

const IS_WEB = Platform.OS === 'web';

// ─── MODULE: ROLE DECODER ────────────────────────────────────────────────────
// Translates Supabase RBAC string into Liquid Neon styling parameters
const getRoleConfig = (role?: string) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        label: 'ADMIN',
        bg: 'rgba(255,51,102,0.15)',
        text: '#FF3366',
        border: 'rgba(255,51,102,0.3)',
      };
    case 'premium':
      return {
        label: 'PREMIUM',
        bg: 'rgba(255,170,0,0.15)',
        text: '#FFD700',
        border: 'rgba(255,170,0,0.3)',
      };
    default:
      return {
        label: 'MEMBER',
        bg: 'rgba(0,240,255,0.15)',
        text: '#00F0FF',
        border: 'rgba(0,240,255,0.3)',
      };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: NEBULA AMBIENT ENGINE
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
        pointerEvents="none"
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
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
      <OrganicOrb
        color={THEME.pink}
        size={width * 0.4}
        initialX={width * 0.5}
        initialY={height * 0.8}
        speedX={0.25}
        speedY={0.1}
        phaseOffsetX={Math.PI / 4}
        phaseOffsetY={Math.PI}
        opacityBase={0.05}
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: BIOMETRIC IDENTITY MATRIX (Animated SVG)
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedProfileMatrix = () => {
  const floatY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const outerRot = useSharedValue(0);
  const innerRot = useSharedValue(360);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    outerRot.value = withRepeat(
      withTiming(360, { duration: 18000, easing: Easing.linear }),
      -1,
      false,
    );

    innerRot.value = withRepeat(
      withTiming(0, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRot.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRot.value}deg` }],
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
      {/* LAYER 1: Clockwise Outer Tech Ring */}
      <Animated.View
        style={[{ position: 'absolute', width: 140, height: 140 }, outerStyle]}
      >
        <Svg width="140" height="140" viewBox="0 0 140 140">
          <Circle
            cx="70"
            cy="70"
            r="66"
            stroke={THEME.cyan}
            strokeWidth="1"
            strokeDasharray="10 15"
            fill="none"
            opacity="0.4"
          />
          <Circle cx="70" cy="4" r="3" fill={THEME.cyan} />
          <Circle cx="70" cy="136" r="3" fill={THEME.cyan} />
        </Svg>
      </Animated.View>

      {/* LAYER 2: Counter-Clockwise Inner Data Ring */}
      <Animated.View
        style={[{ position: 'absolute', width: 140, height: 140 }, innerStyle]}
      >
        <Svg width="140" height="140" viewBox="0 0 140 140">
          <Circle
            cx="70"
            cy="70"
            r="52"
            stroke={THEME.purple}
            strokeWidth="2"
            strokeDasharray="30 40"
            fill="none"
            opacity="0.6"
          />
          <Path d="M 18 70 L 24 70" stroke={THEME.pink} strokeWidth="2" />
          <Path d="M 116 70 L 122 70" stroke={THEME.pink} strokeWidth="2" />
        </Svg>
      </Animated.View>

      {/* LAYER 3: Pulsing Central Core */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 140,
            height: 140,
            alignItems: 'center',
            justifyContent: 'center',
          },
          pulseStyle,
        ]}
      >
        <Svg width="60" height="60" viewBox="0 0 60 60">
          <Circle
            cx="30"
            cy="30"
            r="28"
            fill="rgba(0, 240, 255, 0.1)"
            stroke={THEME.cyan}
            strokeWidth="1"
            opacity="0.5"
          />
          <Circle cx="30" cy="22" r="10" fill={THEME.cyan} opacity="0.9" />
          <Path
            d="M 10 50 C 10 38, 50 38, 50 50 Z"
            fill={THEME.cyan}
            opacity="0.9"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

// ─── MODULE: STAT PILL ───────────────────────────────────────────────────────
const StatPill = memo(
  ({ icon: Icon, label, value, color = '#00F0FF' }: any) => (
    <View
      className="items-center flex-1 p-4 border rounded-2xl border-white/10"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <Icon size={16} color={color} />
      <Text className="text-[8px] font-black uppercase tracking-[2px] text-white/30 mt-2">
        {label}
      </Text>
      <Text
        className="text-[10px] font-bold text-white/80 mt-1"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  ),
);
StatPill.displayName = 'StatPill';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: PRIMARY SCREEN ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════
export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [memberSince, setMemberSince] = useState('');

  const userRole = profile?.role || 'member';
  const roleConfig = getRoleConfig(userRole);

  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.3);

  const pulseRing = useCallback(() => {
    ringScale.value = withSequence(withSpring(1.15), withSpring(1));
    ringOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0.3, { duration: 600 }),
    );
  }, [ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        if (data) {
          setFullName(data.full_name ?? '');
          setAvatarUrl(data.avatar_url ?? '');
        }
        if (user.created_at) {
          setMemberSince(
            new Date(user.created_at).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            }),
          );
        }
      } catch (err) {
        console.error('Profile sync error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handlePickImage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Error', 'Gallery access is required.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    performAvatarSync(result.assets[0]);
  }, [user]);

  const performAvatarSync = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploading(true);
    pulseRing();
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;

      let uploadError;

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: `image/${ext}`,
            upsert: true,
          });
        uploadError = error;
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: fileName,
          type: `image/${ext}`,
        } as any);
        const { error } = await supabase.storage
          .from('avatars')
          .upload(fileName, formData, { upsert: true });
        uploadError = error;
      }

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      setAvatarUrl(urlData.publicUrl);

      await supabase
        .from('profiles')
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);

      await supabase.auth.updateUser({
        data: { avatar_url: urlData.publicUrl },
      });
      pulseRing();
    } catch (err: any) {
      console.error('[Avatar Sync]', err);
      Alert.alert(
        'Upload Interrupted',
        err.message || 'Storage node unreachable.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = useCallback(async () => {
    if (!user || !fullName.trim()) {
      Alert.alert('Input Required', 'Username designation cannot be blank.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;

      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      Alert.alert('Cloud Sync Error', err.message);
    } finally {
      setIsSaving(false);
    }
  }, [user, fullName]);

  return (
    <SafeAreaView className="flex-1 bg-[#000016]">
      {/* ── NEBULA AMBIENT BACKGROUND ── */}
      <AmbientArchitecture />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 150 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-2xl px-6 pt-12 mx-auto">
            {/* ─── CENTRALLY ALIGNED RETURN NAVIGATION & SVG HEADER ──────────── */}
            <FadeIn
              delay={100}
              className="relative z-50 items-center justify-center w-full mb-12"
            >
              {/* Isolated Touch Node (CRITICAL FIX: Removed rogue text node) */}
              <TouchableOpacity
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace('/settings')
                }
                className="absolute left-0 z-50 flex-row items-center gap-x-2 active:scale-95"
                activeOpacity={0.7}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <ArrowBigLeftDash size={20} color={THEME.cyan} />
                <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase hidden md:flex">
                  RETURN
                </Text>
              </TouchableOpacity>

              {/* Centered Profile Matrix */}
              <View className="items-center">
                <AnimatedProfileMatrix />
                <View className="h-[2px] w-20 bg-[#00F0FF] mt-4 rounded-full shadow-[0_0_15px_#00F0FF]" />
              </View>

              {/* RBAC Role Tag */}
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 20,
                  backgroundColor: roleConfig.bg,
                  borderColor: roleConfig.border,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color: roleConfig.text,
                    fontSize: 10,
                    fontWeight: '900',
                    letterSpacing: 2,
                  }}
                >
                  {roleConfig.label}
                </Text>
              </View>
            </FadeIn>

            {/* ─── MODULE: AVATAR MANAGEMENT ───────────────────────────────── */}
            <FadeIn delay={100}>
              <GlassCard className="items-center p-10 mb-8 border-white/5">
                <View className="relative mb-8">
                  {/* Reactive energy ring */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      ringStyle,
                      {
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: THEME.cyan,
                      },
                    ]}
                  />

                  <View
                    className="items-center justify-center overflow-hidden border-2 rounded-full bg-black/80 border-[#00F0FF]/40"
                    style={{ width: 144, height: 144 }}
                  >
                    {isUploading ? (
                      <ActivityIndicator color={THEME.cyan} />
                    ) : avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <User size={56} color={THEME.cyan} />
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    className="absolute bottom-1 right-1 w-11 h-11 rounded-full bg-[#00F0FF] items-center justify-center border-4 border-[#020205]"
                  >
                    <Pencil size={18} color="#020205" />
                  </TouchableOpacity>
                </View>

                {/* Avatar action pill */}
                <View style={styles.actionPillWrapper}>
                  <View style={styles.actionPillContainer}>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      disabled={isUploading}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      {isUploading ? (
                        <Text style={styles.actionTextTransferring}>
                          Transferring...
                        </Text>
                      ) : avatarUrl ? (
                        <ArrowBigUpDash size={22} color="rgba(9,186,112,0.8)" />
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Upload size={16} color={THEME.cyan} />
                          <Text style={styles.actionTextUpload}>
                            UPDATE AVATAR
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* CRITICAL DOM FIX: Strict ternary prevents empty string ("") node crash in React Native */}
                    {avatarUrl ? (
                      !isUploading ? (
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <View style={styles.actionDivider} />
                          <TouchableOpacity
                            onPress={() => setAvatarUrl('')}
                            style={styles.actionButton}
                            activeOpacity={0.7}
                          >
                            <RotateCcw size={20} color={THEME.pink} />
                          </TouchableOpacity>
                        </View>
                      ) : null
                    ) : null}
                  </View>
                </View>
              </GlassCard>
            </FadeIn>

            {/* ─── MODULE: IDENTITY FORM ────────────────────────────────────── */}
            <FadeIn delay={200}>
              <GlassCard className="p-8 mb-8 border-white/5">
                <View className="gap-y-10">
                  <View>
                    <View className="flex-row items-center mb-4 ml-1">
                      <User size={14} color={THEME.cyan} />
                      <Text className="text-[#00F0FF] font-black text-[10px] tracking-[4px] uppercase ml-3">
                        USERNAME
                      </Text>
                    </View>
                    <View className="h-16 overflow-hidden border bg-black/60 border-white/15 rounded-2xl">
                      <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="User Name"
                        placeholderTextColor="rgba(255,255,255,0.15)"
                        autoCapitalize="words"
                        autoCorrect={false}
                        style={
                          {
                            flex: 1,
                            height: '100%',
                            color: '#FFFFFF',
                            fontSize: 18,
                            fontWeight: '700',
                            paddingVertical: 0,
                            margin: 0,
                            paddingHorizontal: 16,
                            textAlignVertical: 'center',
                            ...(IS_WEB ? { outlineStyle: 'none' } : {}),
                          } as any
                        }
                      />
                    </View>
                  </View>

                  <View>
                    <View className="flex-row items-center mb-4 ml-1">
                      <Mail size={14} color="rgba(255,255,255,0.3)" />
                      <Text className="text-white/30 font-black text-[10px] tracking-[4px] uppercase ml-3">
                        System Email
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between h-16 px-6 border opacity-50 bg-white/5 border-white/5 rounded-2xl">
                      <Text className="font-mono text-sm tracking-tight text-white/40">
                        {user?.email || 'N/A'}
                      </Text>
                      <Shield size={14} color="rgba(255,255,255,0.1)" />
                    </View>
                  </View>
                </View>

                <Button
                  title={
                    isSaving
                      ? 'SYNCING...'
                      : saved
                        ? 'IDENTITY UPDATED'
                        : 'SAVE CHANGES'
                  }
                  onPress={handleSaveProfile}
                  variant={saved ? 'secondary' : 'primary'}
                  className="py-5 mt-12 shadow-2xl"
                  isLoading={isSaving}
                />
              </GlassCard>
            </FadeIn>

            {/* ─── MODULE: TELEMETRY PILLS ──────────────────────────────────── */}
            <FadeIn delay={300}>
              <View className="flex-row gap-x-4">
                <StatPill
                  icon={Globe}
                  label="Network"
                  value="SECURE"
                  color={THEME.cyan}
                />
                <StatPill
                  icon={Sparkles}
                  label="CREATED"
                  value={memberSince || 'Just now'}
                  color={THEME.pink}
                />
              </View>
            </FadeIn>

            {/* ─── FOOTER ───────────────────────────────────────────────────── */}
            <View className="items-center mt-20 opacity-30">
              <View className="h-[1px] w-12 bg-white/20 mb-4" />
              <Text className="text-[9px] font-mono tracking-[6px] text-white uppercase">
                VeraxAI PROFILE INTERFACE
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
  actionPillWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  actionPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,10,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    height: 56,
  },
  actionButton: {
    paddingHorizontal: 20,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  actionTextUpload: {
    color: THEME.cyan,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  actionTextTransferring: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});
