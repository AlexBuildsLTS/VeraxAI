/**
 * FILE: app/(dashboard)/settings/profile.tsx
 * - expo-image-picker → Supabase Storage (avatars bucket)

 * - Animated avatar ring on upload
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowBigLeftDash,
  Camera,
  User,
  Mail,
  Upload,
  Check,
  Sparkles,
  Shield,
  Fingerprint,
  Globe,
  Pencil,
  RotateCcw,
} from 'lucide-react-native';

import { GlassCard } from '../../../components/ui/GlassCard';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase/client';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

// ── Ambient orb ───────────────────────────────────────────────────────────────

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

// ── Stat pill ─────────────────────────────────────────────────────────────────

const StatPill = ({
  icon: Icon,
  label,
  value,
  color = '#00F0FF',
}: {
  icon: any;
  label: string;
  value: string;
  color?: string;
}) => (
  <View
    className="items-center flex-1 p-4 border rounded-2xl border-white/5 gap-y-1"
    style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
  >
    <Icon size={16} color={color} />
    <Text className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-1">
      {label}
    </Text>
    <Text
      className="text-[10px] font-bold text-white/70 text-center"
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [memberSince, setMemberSince] = useState('');

  // Avatar ring animation
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.3);

  const pulseRing = useCallback(() => {
    ringScale.value = withSequence(
      withSpring(1.15, { damping: 8 }),
      withSpring(1, { damping: 12 }),
    );
    ringOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0.3, { duration: 600 }),
    );
  }, [ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // ── Load profile ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();
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
      setIsLoading(false);
    }
    loadProfile();
  }, [user]);

  // ── Image picker + upload ────────────────────────────────────────────────

  const handlePickImage = useCallback(async () => {
    // Request permissions
    if (Platform.OS !== 'web') {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Allow photo library access to upload an avatar.',
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    setIsUploading(true);
    pulseRing();

    try {
      // Convert to blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;

      // Upload to Supabase Storage (avatars bucket — public)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: asset.mimeType ?? `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      // Save immediately
      await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      pulseRing();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Could not upload image.');
    } finally {
      setIsUploading(false);
    }
  }, [user, pulseRing]);

  // ── Camera capture ───────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Camera capture is not available on web.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Allow camera access to take a photo.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    setIsUploading(true);
    pulseRing();

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = `${user!.id}/avatar_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      pulseRing();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Could not upload photo.');
    } finally {
      setIsUploading(false);
    }
  }, [user, pulseRing]);

  // ── Remove avatar ────────────────────────────────────────────────────────

  const handleRemoveAvatar = useCallback(async () => {
    setAvatarUrl('');
    await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user!.id);
    await supabase.auth.updateUser({ data: { avatar_url: null } });
  }, [user]);

  // ── Save name ────────────────────────────────────────────────────────────

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    setIsSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      Alert.alert('Sync Failed', error.message);
    } else {
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setIsSaving(false);
  }, [user, fullName, avatarUrl]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#020205] items-center justify-center">
        <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
          <NeuralOrb delay={0} color="#00F0FF" />
          <NeuralOrb delay={2500} color="#8A2BE2" />
        </View>
        <ActivityIndicator color="#00F0FF" size="large" />
        <Text className="text-neon-cyan font-bold text-[10px] tracking-[6px] uppercase mt-4">
          Loading Profile...
        </Text>
      </SafeAreaView>
    );
  }

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : (user?.email?.charAt(0).toUpperCase() ?? 'U');

  return (
    <SafeAreaView className="flex-1 bg-[#020205]">
      {/* Ambient background */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#00F0FF" />
        <NeuralOrb delay={2500} color="#FF007F" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: isMobile ? 20 : 60,
          paddingTop: isMobile ? 60 : 60,
          paddingBottom: 160,
        }}
      >
        {/* ── Back ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/settings' as any)
          }
          className="flex-row items-center mb-10 gap-x-2"
          activeOpacity={0.7}
        >
          <ArrowBigLeftDash size={18} color="#00F0FF" />
          <Text className="text-[10px] font-black tracking-[4px] text-neon-cyan uppercase">
            Return
          </Text>
        </TouchableOpacity>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <FadeIn>
          <View className="mb-10">
            <Text className="text-neon-cyan font-black text-[10px] tracking-[8px] uppercase mb-2"></Text>
            <Text className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-[45px]">
              EDIT <Text className="text-neon-cyan">PROFILE</Text>
            </Text>
            <View className="h-[2px] w-16 bg-neon-cyan mt-4 rounded-full shadow-[0_0_20px_#00F0FF]" />
          </View>
        </FadeIn>

        {/* ── Avatar card ────────────────────────────────────────────────── */}
        <FadeIn delay={100}>
          <GlassCard glowColor="cyan" className="p-8 mb-6">
            <Text className="text-white/30 text-[10px] font-bold uppercase tracking-[4px] mb-6">
              Avatar
            </Text>

            {/* Avatar circle with animated ring */}
            <View className="items-center mb-6">
              <View className="relative">
                {/* Glow ring */}
                <Animated.View
                  style={[
                    ringStyle,
                    {
                      position: 'absolute',
                      top: -6,
                      left: -6,
                      right: -6,
                      bottom: -6,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: '#00F0FF',
                    },
                  ]}
                />

                {/* Avatar circle */}
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderWidth: 2,
                    borderColor: 'rgba(0,240,255,0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#00F0FF" />
                  ) : avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 100, height: 100 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-3xl font-black text-neon-cyan">
                      {initials}
                    </Text>
                  )}
                </View>

                {/* Camera badge */}
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isUploading}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: '#00F0FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#020205',
                  }}
                >
                  <Pencil size={12} color="#020205" />
                </TouchableOpacity>
              </View>

              <Text className="text-white/30 text-[10px] font-mono uppercase tracking-widest mt-4">
                Avatar Display Node
              </Text>
              {user?.email && (
                <Text className="text-white/20 text-[9px] font-mono mt-1">
                  {user.email}
                </Text>
              )}
            </View>

            {/* Upload action buttons */}
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isUploading}
                className="flex-row items-center justify-center flex-1 py-3 border gap-x-2 rounded-2xl border-neon-cyan/30 bg-neon-cyan/5"
                activeOpacity={0.7}
              >
                <Upload size={14} color="#00F0FF" />
                <Text className="text-neon-cyan text-[10px] font-black uppercase tracking-widest">
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Text>
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  disabled={isUploading}
                  className="flex-row items-center justify-center flex-1 py-3 border gap-x-2 rounded-2xl border-white/10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                  activeOpacity={0.7}
                >
                  <Camera size={14} color="#A1A1AA" />
                  <Text className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                    Camera
                  </Text>
                </TouchableOpacity>
              )}

              {avatarUrl ? (
                <TouchableOpacity
                  onPress={handleRemoveAvatar}
                  disabled={isUploading}
                  className="items-center justify-center px-4 py-3 border rounded-2xl border-neon-pink/20 bg-neon-pink/5"
                  activeOpacity={0.7}
                >
                  <RotateCcw size={14} color="#FF007F" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text className="text-white/20 text-[8px] font-mono uppercase tracking-widest text-center mt-3">
              JPG, PNG or WEBP · Max 5MB · Auto-cropped square
            </Text>
          </GlassCard>
        </FadeIn>

        {/* ── Identity card ───────────────────────────────────────────────── */}
        <FadeIn delay={200}>
          <GlassCard glowColor="cyan" className="p-8 mb-6">
            <Text className="text-white/30 text-[10px] font-bold uppercase tracking-[4px] mb-6">
              Identity
            </Text>

            <View className="gap-y-4">
              {/* Name field with icon */}
              <View>
                <Text className="text-neon-cyan font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
                  Operative Name
                </Text>
                <View
                  className="flex-row items-center px-4 border border-white/10 rounded-2xl h-14"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <User size={16} color="#A1A1AA" />
                  <View className="flex-1 ml-3">
                    <Input
                      placeholder="Enter full designation"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      className="p-0 mb-0 bg-transparent border-0"
                    />
                  </View>
                </View>
              </View>

              {/* Email (read only) */}
              <View>
                <Text className="text-white/30 font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
                  Registered Email
                </Text>
                <View
                  className="flex-row items-center px-4 border border-white/5 rounded-2xl h-14"
                  style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}
                >
                  <Mail size={16} color="#52525B" />
                  <Text className="flex-1 ml-3 text-sm font-medium text-white/30">
                    {user?.email ?? '—'}
                  </Text>
                  <View className="px-2 py-1 border rounded-full bg-white/5 border-white/10">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-white/20">
                      Locked
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Save button */}
            <Button
              title={
                isSaving ? 'SYNCING...' : saved ? 'SAVED ✓' : 'UPDATE IDENTITY'
              }
              onPress={handleSaveProfile}
              isLoading={isSaving}
              variant="primary"
              className={`py-5 mt-6 shadow-lg ${saved ? 'shadow-neon-lime/20' : 'shadow-neon-cyan/20'}`}
            >
              {!isSaving && saved && <Check size={16} color="#32FF00" />}
            </Button>
          </GlassCard>
        </FadeIn>

        {/* ── Account stats ───────────────────────────────────────────────── */}
        <FadeIn delay={300}>
          <GlassCard glowColor="purple" className="p-8 mb-6">
            <Text className="text-white/30 text-[10px] font-bold uppercase tracking-[4px] mb-4">
              USER STATE
            </Text>
            <View className="flex-row gap-x-3">
              <StatPill
                icon={Shield}
                label="Auth"
                value="Active"
                color="#00F0FF"
              />
              <StatPill
                icon={Fingerprint}
                label="Provider"
                value={user?.app_metadata?.provider ?? 'email'}
                color="#8A2BE2"
              />
              <StatPill
                icon={Globe}
                label="Since"
                value={memberSince || '—'}
                color="#A1A1AA"
              />
            </View>
          </GlassCard>
        </FadeIn>

        {/* ── Tips ────────────────────────────────────────────────────────── */}
        <FadeIn delay={400}>
          <View className="flex-row items-start px-2 gap-x-3">
            <Sparkles size={14} color="#8A2BE2" style={{ marginTop: 2 }} />
            <Text className="text-white/20 text-[10px] font-mono leading-5 flex-1">
              NorthOS
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}
