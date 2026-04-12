/**
 * app/(dashboard)/settings/profile.tsx
 * ══════════════════════════════════════════════════════════════════════════════
 * User Profile Management — Identity data, avatar sync, and account metrics.
 * Architecture: 2026 High-Performance Standards (Web Vercel & Native APK)
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
  TextInput, // Directly imported for absolute cross-platform alignment control
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer'; // Required for Native Android binary uploads
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── ICONS ───────────────────────────────────────────────────────────────────
import {
  ArrowBigLeftDash,
  ArrowBigUpDash,
  User,
  Mail,
  Sparkles,
  Shield,
  Fingerprint,
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

// ─── ANIMATION ENGINE ────────────────────────────────────────────────────────
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

// ─── MODULE: ROLE DECODER ────────────────────────────────────────────────────
// Maps user role string to visual badge color tokens.
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

// ─── MODULE: AMBIENT NEURAL ORBS ─────────────────────────────────────────────
// Hardware-accelerated background glow. pointerEvents="none" prevents
// touch interception on Android APK.
const NeuralOrb = memo(
  ({ delay = 0, color = '#00F0FF' }: { delay?: number; color?: string }) => {
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
        pointerEvents="none"
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
  },
);
NeuralOrb.displayName = 'NeuralOrb';

// ─── MODULE: STAT PILL ───────────────────────────────────────────────────────
// Small metric card displaying a single user metadata value with icon.
const StatPill = memo(
  ({
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

// ─── MODULE: PRIMARY SCREEN ───────────────────────────────────────────────────
export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();

  // ─── LOCAL STATE ─────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [memberSince, setMemberSince] = useState('');

  const userRole = profile?.role || 'member';
  const roleConfig = getRoleConfig(userRole);

  // ─── AVATAR RING PHYSICS ──────────────────────────────────────────────────
  // Pulse animation triggered on avatar upload events.
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

  // ─── IDENTITY SYNC ────────────────────────────────────────────────────────
  // Loads profile data from Supabase on mount.
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

  // ─── MEDIA LIBRARY BRIDGE ─────────────────────────────────────────────────
  // Requests gallery permission then launches the image picker.
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

  // ─── STORAGE BUCKET UPLOAD ENGINE ────────────────────────────────────────
  const performAvatarSync = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploading(true);
    pulseRing();
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;
      
      let uploadError;

      if (Platform.OS === 'web') {
        // Web Environment: Fetch natively resolves the Blob
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        const { error } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { 
            contentType: `image/${ext}`, 
            upsert: true 
          });
        uploadError = error;
      } else {
        // Native Environment: React Native FormData bypasses URI fetch restrictions
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: fileName,
          type: `image/${ext}`,
        } as any);

        const { error } = await supabase.storage
          .from('avatars')
          .upload(fileName, formData, { 
            upsert: true 
          });
        uploadError = error;
      }

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(urlData.publicUrl);

      // Commit to Database Profile
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
  // ─── DATABASE IDENTITY COMMIT ─────────────────────────────────────────────
  // Persists full name changes to Supabase profiles table and auth metadata.
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

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  const handleReturn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#020205] items-center justify-center">
        <ActivityIndicator color="#00F0FF" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#020205]">
      {/* Ambient background orbs */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#00F0FF" />
        <NeuralOrb delay={4000} color="#FF007F" />
      </View>

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
            {/* ─── RETURN BUTTON ───────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleReturn}
              className="flex-row items-center mb-12 gap-x-3"
              activeOpacity={0.7}
            >
              <ArrowBigLeftDash size={24} color="#00F0FF" />
              <Text className="text-[11px] font-black tracking-[4px] text-[#00F0FF] uppercase">
                RETURN
              </Text>
            </TouchableOpacity>

            {/* ─── PAGE HEADER ─────────────────────────────────────────────── */}
            <FadeIn>
              <View className="flex-row items-center justify-between mb-12">
                <View>
                  <Text className="text-5xl font-black leading-none tracking-tighter text-[#00F0FF] uppercase md:text-6xl">
                    PROFILE
                  </Text>
                  <View className="h-1 w-24 bg-[#00F0FF] mt-6 rounded-full shadow-[0_0_15px_#00F0FF]" />
                </View>
                <View
                  style={{
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
                        borderColor: '#00F0FF',
                      },
                    ]}
                  />

                  <View
                    className="items-center justify-center overflow-hidden border-2 rounded-full bg-black/80 border-[#00F0FF]/40"
                    style={{ width: 144, height: 144 }}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#00F0FF" />
                    ) : avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <User size={56} color="#00F0FF" />
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
                          <Upload size={16} color="#00F0FF" />
                          <Text style={styles.actionTextUpload}>
                            UPDATE AVATAR
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {avatarUrl && !isUploading && (
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View style={styles.actionDivider} />
                        <TouchableOpacity
                          onPress={() => setAvatarUrl('')}
                          style={styles.actionButton}
                          activeOpacity={0.7}
                        >
                          <RotateCcw size={20} color="#FF007F" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </GlassCard>
            </FadeIn>

            {/* ─── MODULE: IDENTITY FORM ────────────────────────────────────── */}
            <FadeIn delay={200}>
              <GlassCard className="p-8 mb-8 border-white/5">
                <View className="gap-y-10">
                  {/* Full name input (FIXED: Precise vertical centering) */}
                  <View>
                    <View className="flex-row items-center mb-4 ml-1">
                      <User size={14} color="#00F0FF" />
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
                            ...(Platform.OS === 'web'
                              ? { outlineStyle: 'none' }
                              : {}),
                          } as any
                        }
                      />
                    </View>
                  </View>

                  {/* Email — read only */}
                  <View>
                    <View className="flex-row items-center mb-4 ml-1">
                      <Mail size={14} color="rgba(255,255,255,0.3)" />
                      <Text className="text-white/30 font-black text-[10px] tracking-[4px] uppercase ml-3">
                        System Email
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between h-16 px-6 border opacity-50 bg-white/5 border-white/5 rounded-2xl">
                      <Text className="font-mono text-sm tracking-tight text-white/40">
                        {user?.email}
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
                  icon={Fingerprint}
                  label="Provider"
                  value={
                    user?.app_metadata?.provider?.toUpperCase() || 'EXTERNAL'
                  }
                  color="#8A2BE2"
                />
                <StatPill
                  icon={Globe}
                  label="Network"
                  value="SECURE"
                  color="#00F0FF"
                />
                <StatPill
                  icon={Sparkles}
                  label="CREATED"
                  value={memberSince}
                  color="#FF007F"
                />
              </View>
            </FadeIn>

            {/* ─── FOOTER ───────────────────────────────────────────────────── */}
            <View className="items-center mt-20 opacity-30">
              <View className="h-[1px] w-12 bg-white/20 mb-4" />
              <Text className="text-[9px] font-mono tracking-[6px] text-white uppercase">
                VerAI PROFILE INTERFACE
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
    color: '#00F0FF',
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
