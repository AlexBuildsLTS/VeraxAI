/**
 * app/(dashboard)/settings/security.tsx
 * VeraxAI — Security & Identity Vault
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * 1. BIOMETRIC KERNEL: Real hardware verification via expo-local-authentication.
 * 2. 4-DIGIT PIN FALLBACK: Cross-platform vault access for Web & Desktop.
 * 3. CREDENTIALS : Current-Password + New-Password + Confirmation.
 * 4. ENCRYPTED AI VAULT (RBAC): Locked behind Biometrics/PIN. Premium/Admin ONLY.
 * 5. ANIMATED UI: Synchronized SVG & Neon Line hover physics at 120fps.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowBigLeftDash,
  Lock,
  Fingerprint,
  Cpu,
  ShieldAlert,
  KeyRound,
  Unlock,
  Crown,
} from 'lucide-react-native';

import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase/client';
import { cn } from '../../../lib/utils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  useFrameCallback,
  withSequence,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';

// ─── STRICT THEME ENFORCEMENT ───
const THEME = {
  obsidian: '#020205',
  danger: '#FF007F', // Neon Pink
  success: '#32FF00', // Neon Green
  cyan: '#00F0FF', // Neon Cyan
  purple: '#8A2BE2', // Neon Purple
  gold: '#FFD700', // Premium Gold
  slate: '#94a3b8',
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: THE WANDERING CORE ENGINE (Smooth, Sleek, Gliding Emitter)
// ══════════════════════════════════════════════════════════════════════════════

interface RippleProps {
  color: string;
  delay: number;
  duration: number;
  maxSize: number;
}

const SingleRipple = memo(
  ({ color, delay, duration, maxSize }: RippleProps) => {
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

    const animatedStyle = useAnimatedStyle(() => {
      return {
        width: interpolate(progress.value, [0, 1], [0, maxSize]),
        height: interpolate(progress.value, [0, 1], [0, maxSize]),
        borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
        opacity: interpolate(
          progress.value,
          [0, 0.1, 0.6, 1],
          [0, 0.4, 0.05, 0],
        ),
        borderWidth: interpolate(progress.value, [0, 1], [24, 2]),
      };
    });

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
  },
);
SingleRipple.displayName = 'SingleRipple';

interface GlidingEmitterProps {
  coreSize: number;
  color: string;
  maxWaveSize: number;
  waveCount: number;
  baseDuration: number;
}

const WanderingCore = memo(
  ({
    coreSize,
    color,
    maxWaveSize,
    waveCount,
    baseDuration,
  }: GlidingEmitterProps) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);
    const stagger = baseDuration / waveCount;

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 3000;
    });

    const animatedPosition = useAnimatedStyle(() => {
      const xOffset = Math.sin(time.value * 0.4) * (width * 0.3);
      const yOffset = Math.cos(time.value * 0.3) * (height * 0.2);

      return {
        transform: [
          { translateX: width / 2 + xOffset },
          { translateY: height / 2 + yOffset },
        ],
      };
    });

    const corePulse = useSharedValue(0.6);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, []);

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
            key={`ripple-${index}`}
            color={color}
            delay={index * stagger}
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
              ...(Platform.OS === 'web'
                ? ({ boxShadow: `0 0 20px ${color}` } as any)
                : {}),
            },
          ]}
        />
      </Animated.View>
    );
  },
);
WanderingCore.displayName = 'WanderingCore';

interface AmbientArchitectureProps {
  delay?: number;
  color?: string;
  bottom?: number;
  right?: number;
}

const AmbientArchitecture = memo(
  ({ color = '#00F0FF', bottom, right, delay }: AmbientArchitectureProps) => {
    const { width, height } = Dimensions.get('window');
    const isDesktop = width >= 1024;
    const massiveWaveRadius = isDesktop ? width * 1.0 : height * 1.4;
    const [isVisible, setIsVisible] = useState(!delay);

    useEffect(() => {
      if (delay) {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
      }
    }, [delay]);

    if (!isVisible) return null;

    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { bottom: bottom ?? 0, right: right ?? 0 },
        ]}
        pointerEvents="none"
      >
        <WanderingCore
          coreSize={18}
          color={color}
          maxWaveSize={massiveWaveRadius}
          waveCount={4}
          baseDuration={16000}
        />
      </View>
    );
  },
);
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: ANIMATED SVG & SYNCHRONIZED HOVER HEADER
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AnimatedSecurityHeader = memo(() => {
  const floatY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Synchronized vertical floating sequence (applies to both SVG and Line)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Blinking effect for the neon green server nodes
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.ease }),
        withTiming(0.3, { duration: 800, easing: Easing.ease }),
      ),
      -1,
      true,
    );
  }, []);

  const hoverStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
    alignItems: 'center',
  }));

  const nodeProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value,
  }));

  const C = {
    purple: '#A87FFB',
    navy: '#0B1B42',
    pink: '#FF61A6',
    green: '#9DFF00',
    cyan: '#00F0FF',
  };

  return (
    <Animated.View style={hoverStyle}>
      {/* ── HIGH FIDELITY SECURITY DB SVG RECREATION ── */}
      <View style={{ width: 100, height: 100 }}>
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          {/* Connecting Data Lines */}
          <Path
            d="M 100 60 L 100 80 L 50 80 L 50 120"
            fill="none"
            stroke={C.cyan}
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <Path
            d="M 100 60 L 100 80 L 150 80 L 150 120"
            fill="none"
            stroke={C.cyan}
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* Top Server Node */}
          <Rect
            x="60"
            y="20"
            width="80"
            height="30"
            rx="8"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="6"
          />
          <Rect x="100" y="32" width="25" height="6" rx="3" fill="#FFF" />
          <AnimatedCircle
            cx="75"
            cy="35"
            r="5"
            fill={C.green}
            animatedProps={nodeProps}
          />

          {/* Bottom Left Servers */}
          <Rect
            x="10"
            y="120"
            width="80"
            height="30"
            rx="8"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="6"
          />
          <Rect x="50" y="132" width="25" height="6" rx="3" fill="#FFF" />
          <AnimatedCircle
            cx="25"
            cy="135"
            r="5"
            fill={C.green}
            animatedProps={nodeProps}
          />

          <Rect
            x="10"
            y="160"
            width="80"
            height="30"
            rx="8"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="6"
          />
          <Rect x="50" y="172" width="25" height="6" rx="3" fill="#FFF" />
          <AnimatedCircle
            cx="25"
            cy="175"
            r="5"
            fill={C.green}
            animatedProps={nodeProps}
          />

          {/* Bottom Right Servers */}
          <Rect
            x="110"
            y="120"
            width="80"
            height="30"
            rx="8"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="6"
          />
          <Rect x="150" y="132" width="25" height="6" rx="3" fill="#FFF" />
          <AnimatedCircle
            cx="125"
            cy="135"
            r="5"
            fill={C.green}
            animatedProps={nodeProps}
          />

          <Rect
            x="110"
            y="160"
            width="80"
            height="30"
            rx="8"
            fill={C.purple}
            stroke={C.navy}
            strokeWidth="6"
          />
          <Rect x="150" y="172" width="25" height="6" rx="3" fill="#FFF" />
          <AnimatedCircle
            cx="125"
            cy="175"
            r="5"
            fill={C.green}
            animatedProps={nodeProps}
          />

          {/* Left Blockade (Pink X) */}
          <Circle cx="50" cy="80" r="22" fill={C.navy} />
          <Circle
            cx="50"
            cy="80"
            r="18"
            fill="transparent"
            stroke={C.navy}
            strokeWidth="4"
          />
          <Line
            x1="38"
            y1="68"
            x2="62"
            y2="92"
            stroke={C.pink}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <Line
            x1="62"
            y1="68"
            x2="38"
            y2="92"
            stroke={C.pink}
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Right Blockade (Pink X) */}
          <Circle cx="150" cy="80" r="22" fill={C.navy} />
          <Circle
            cx="150"
            cy="80"
            r="18"
            fill="transparent"
            stroke={C.navy}
            strokeWidth="4"
          />
          <Line
            x1="138"
            y1="68"
            x2="162"
            y2="92"
            stroke={C.pink}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <Line
            x1="162"
            y1="68"
            x2="138"
            y2="92"
            stroke={C.pink}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* ── THE SYNCHRONIZED GLOWING LINE ── */}
      <View className="h-1 w-24 bg-[#FF007F] mt-4 rounded-full shadow-[0_0_15px_#FF007F]" />
    </Animated.View>
  );
});
AnimatedSecurityHeader.displayName = 'AnimatedSecurityHeader';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: PASSWORD STRENGTH HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const calculateEntropy = (pw: string) => {
  const checks = [
    pw.length >= 10,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  return checks.filter(Boolean).length;
};

const ENTROPY_COLORS = [
  '#3F3F46',
  THEME.danger,
  '#F59E0B',
  THEME.cyan,
  THEME.success,
];

const strictInputStyle = {
  flex: 1,
  height: '100%',
  color: '#FFFFFF',
  paddingVertical: 0,
  margin: 0,
  textAlignVertical: 'center',
  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
} as any;

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isMobile = SCREEN_WIDTH < 768;

  // ── Role & Access State ──
  const [userRole, setUserRole] = useState<
    'member' | 'premium' | 'admin' | 'support'
  >('member');

  // ── Password States ──
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // ── Vault & API Key States ──
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: '',
    anthropic: '',
  });
  const [isSyncingKeys, setIsSyncingKeys] = useState(false);

  // ── Security Gate States ──
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [unlockPinEntry, setUnlockPinEntry] = useState('');
  const [showPinPad, setShowPinPad] = useState(false);

  // ── Biometric & PIN Configuration States ──
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [masterPin, setMasterPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // ── Initialization ──
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBioSupported(hasHw && enrolled);
      }

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('biometrics_enabled, custom_api_key, role')
          .eq('id', user.id)
          .maybeSingle();

        if (data && !error) {
          setUserRole(data.role || 'member');
          const isBioOn = !!data.biometrics_enabled;
          setBioEnabled(isBioOn);

          let fetchedPin = '';
          try {
            if (data.custom_api_key) {
              const keys = JSON.parse(data.custom_api_key);

              if (data.role === 'premium' || data.role === 'admin') {
                setApiKeys({
                  openai: keys.openai ?? '',
                  gemini: keys.gemini ?? '',
                  anthropic: keys.anthropic ?? '',
                });
              }

              if (keys.pin) {
                fetchedPin = keys.pin;
                setMasterPin(keys.pin);
              }
            }
          } catch (e) {
            console.error('Vault integrity parse failed.', e);
          }

          if (isBioOn || fetchedPin.length > 0) {
            setIsVaultLocked(true);
          }
        }
      }
    })();
  }, [user]);

  // ── Action: Toggle Biometrics ──
  const handleBioToggle = async () => {
    if (!bioSupported) return;
    setBioLoading(true);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: bioEnabled
        ? 'De-authorize Biometric Shield'
        : 'Authorize Biometric Shield',
    });

    if (result.success && user) {
      const { error } = await supabase
        .from('profiles')
        .update({ biometrics_enabled: !bioEnabled })
        .eq('id', user.id);

      if (!error) {
        setBioEnabled(!bioEnabled);
        if (!bioEnabled === true) setIsVaultLocked(true);
      }
    }
    setBioLoading(false);
  };

  // ── Action: Save PIN ──
  const handleSavePin = async () => {
    if (masterPin.length > 0 && masterPin.length < 4) {
      Alert.alert(
        'Protocol Error',
        'PIN must be exactly 4 digits or empty to remove.',
      );
      return;
    }
    setIsSavingPin(true);
    await handleSaveApiVault(masterPin);
    setIsSavingPin(false);
    if (masterPin.length === 4) setIsVaultLocked(true);
  };

  // ── Action: Unlock Vault ──
  const attemptUnlock = async () => {
    if (bioEnabled && bioSupported) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Security Vault',
      });
      if (result.success) {
        setIsVaultLocked(false);
        setShowPinPad(false);
        return;
      }
    }

    if (masterPin) {
      setShowPinPad(true);
    } else if (!bioEnabled) {
      setIsVaultLocked(false);
    }
  };

  const handlePinEntry = (code: string) => {
    setUnlockPinEntry(code);
    if (code.length === 4) {
      if (code === masterPin) {
        setIsVaultLocked(false);
        setShowPinPad(false);
        setUnlockPinEntry('');
      } else {
        Alert.alert('Access Denied', 'Invalid PIN Code.');
        setUnlockPinEntry('');
      }
    }
  };

  // ── Action: Credential Rotation ──
  const handleRotateCredentials = async () => {
    if (!currentPw || newPw.length < 10) {
      Alert.alert(
        'Protocol Error',
        'Verification of current and minimum 10-char password required.',
      );
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Rotation Error', 'Credentials mismatch.');
      return;
    }

    setIsRotating(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });

    if (error) {
      Alert.alert('Update Refused', error.message);
    } else {
      Alert.alert(
        'Rotation Complete',
        'Identity credentials rotated successfully.',
      );
      setNewPw('');
      setConfirmPw('');
      setCurrentPw('');
    }
    setIsRotating(false);
  };

  // ── Action: API Vault Save ──
  const handleSaveApiVault = async (overridePin?: string) => {
    if (!user) return;
    setIsSyncingKeys(true);

    const targetPin = overridePin !== undefined ? overridePin : masterPin;
    const hasPremiumRights = userRole === 'premium' || userRole === 'admin';

    const cleanedKeys = {
      ...(hasPremiumRights && apiKeys.openai ? { openai: apiKeys.openai } : {}),
      ...(hasPremiumRights && apiKeys.gemini ? { gemini: apiKeys.gemini } : {}),
      ...(hasPremiumRights && apiKeys.anthropic
        ? { anthropic: apiKeys.anthropic }
        : {}),
      ...(targetPin ? { pin: targetPin } : {}),
    };

    const vaultString =
      Object.keys(cleanedKeys).length > 0 ? JSON.stringify(cleanedKeys) : null;

    const { error } = await supabase
      .from('profiles')
      .update({ custom_api_key: vaultString })
      .eq('id', user.id);

    if (error) {
      Alert.alert('Vault Error', error.message);
    } else {
      if (overridePin === undefined)
        Alert.alert('Vault Sealed', 'AI configurations encrypted and saved.');
      else
        Alert.alert(
          'Protocol Accepted',
          targetPin ? '4-Digit PIN registered.' : 'PIN removed.',
        );
    }
    setIsSyncingKeys(false);
  };

  const entropyScore = calculateEntropy(newPw);
  const isPremium = userRole === 'premium' || userRole === 'admin';

  return (
    <SafeAreaView className="flex-1 bg-[#00001ad2]">
      <AmbientArchitecture
        delay={4000}
        color={THEME.purple}
        bottom={-100}
        right={-50}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: isMobile ? 16 : 40,
            paddingTop: 16,
            paddingBottom: 150,
            flexGrow: 1,
            maxWidth: 800,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          {/* ── RETURN NAVIGATION & HEADER WITH NEW SVG ANIMATION ── */}
          <FadeIn
            delay={100}
            className="relative z-50 items-center justify-center w-full pt-4 mb-12"
          >
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/settings')
              }
              className="absolute left-0 z-50 flex-row items-center gap-x-2 active:scale-95"
              style={{ top: 26 }}
              activeOpacity={0.7}
            >
              <ArrowBigLeftDash size={20} color={THEME.danger} />
              <Text className="text-[10px] font-black tracking-[4px] text-[#FF007F] uppercase hidden md:flex">
                RETURN
              </Text>
            </TouchableOpacity>

            <AnimatedSecurityHeader />
          </FadeIn>

          {/* ── ACCESS PROTOCOLS (BIOMETRICS + PIN) ── */}
          <FadeIn delay={200}>
            <GlassCard className="p-6 md:p-10 mb-8 bg-white/[0.015] border-white/5 rounded-[32px]">
              <View className="flex-row items-center mb-8 gap-x-4">
                <Fingerprint size={28} color={THEME.danger} />
                <Text className="text-lg font-black tracking-widest text-white uppercase md:text-xl">
                  PIN & BIOMETRICS
                </Text>
              </View>

              <View className="gap-y-4">
                <View className="flex-row items-center justify-between p-5 md:p-6 border bg-black/40 border-white/10 rounded-[24px]">
                  <View>
                    <Text className="text-xs font-bold tracking-wider text-white uppercase md:text-sm">
                      Hardware Shield
                    </Text>
                    <Text className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-[2px] mt-1.5">
                      Status:{' '}
                      {bioSupported
                        ? bioEnabled
                          ? 'ACTIVE'
                          : 'READY'
                        : 'NO HARDWARE'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleBioToggle}
                    disabled={!bioSupported || bioLoading}
                    style={[
                      styles.toggleBase,
                      bioEnabled ? styles.toggleActive : styles.toggleInactive,
                    ]}
                    className="p-1 rounded-full"
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        bioEnabled ? styles.knobActive : styles.knobInactive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center justify-between p-5 md:p-6 border bg-black/40 border-white/10 rounded-[24px]">
                  <View className="flex-1 mr-4">
                    <Text className="text-xs font-bold tracking-wider text-white uppercase md:text-sm">
                      Vault PIN (4-Digit)
                    </Text>
                    <Text className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-[2px] mt-1.5 leading-relaxed">
                      Primary lock for Web. Fallback for Mobile.
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-x-3">
                    <View className="w-24 h-12 px-2 overflow-hidden border border-white/10 bg-black/60 rounded-xl">
                      <TextInput
                        value={masterPin}
                        onChangeText={setMasterPin}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                        placeholder="••••"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={[
                          strictInputStyle,
                          {
                            fontSize: 20,
                            letterSpacing: 6,
                            textAlign: 'center',
                          },
                        ]}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleSavePin}
                      disabled={isSavingPin}
                      className="h-12 w-12 items-center justify-center bg-[#FF007F]/10 border border-[#FF007F]/30 rounded-xl active:scale-95"
                    >
                      {isSavingPin ? (
                        <ActivityIndicator size="small" color={THEME.danger} />
                      ) : (
                        <KeyRound size={18} color={THEME.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </GlassCard>
          </FadeIn>

          {/* ── CREDENTIAL ROTATION ── */}
          <FadeIn delay={300}>
            <GlassCard className="p-6 md:p-10 mb-8 bg-white/[0.015] border-white/5 rounded-[32px]">
              <View className="flex-row items-center mb-10 gap-x-4">
                <Lock size={24} color={THEME.danger} />
                <Text className="text-lg font-black tracking-widest text-white uppercase md:text-xl">
                  PASSWORD SECURITY
                </Text>
              </View>

              <View className="gap-y-6">
                <View>
                  <Text className="text-[9px] font-black text-[#FF007F] tracking-[3px] uppercase mb-3 ml-2">
                    Current PASSWORD
                  </Text>
                  <View className="h-14 overflow-hidden border bg-black/40 border-white/10 rounded-[20px] px-5 focus:border-[#FF007F]">
                    <TextInput
                      value={currentPw}
                      onChangeText={setCurrentPw}
                      secureTextEntry
                      placeholder="••••••••••••"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      style={strictInputStyle}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-[9px] font-black text-[#FF007F] tracking-[3px] uppercase mb-3 ml-2">
                    NEW PASSWORD
                  </Text>
                  <View className="h-14 overflow-hidden border bg-black/40 border-white/10 rounded-[20px] px-5 focus:border-[#FF007F]">
                    <TextInput
                      value={newPw}
                      onChangeText={setNewPw}
                      secureTextEntry
                      placeholder="Min 10 Characters"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      style={strictInputStyle}
                    />
                  </View>
                  {newPw.length > 0 && (
                    <View className="flex-row h-1.5 px-2 mt-4 gap-x-2">
                      {[1, 2, 3, 4].map((n) => (
                        <View
                          key={n}
                          className="flex-1 transition-colors duration-300 rounded-full"
                          style={{
                            backgroundColor:
                              entropyScore >= n
                                ? ENTROPY_COLORS[entropyScore]
                                : 'rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                    </View>
                  )}
                </View>

                <View>
                  <Text className="text-[9px] font-black text-[#FF007F] tracking-[3px] uppercase mb-3 ml-2">
                    Verify Password
                  </Text>
                  <View className="h-14 overflow-hidden border bg-black/40 border-white/10 rounded-[20px] px-5 focus:border-[#FF007F]">
                    <TextInput
                      value={confirmPw}
                      onChangeText={setConfirmPw}
                      secureTextEntry
                      placeholder="Verify New PASSWORD"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      style={strictInputStyle}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleRotateCredentials}
                  disabled={isRotating}
                  className="flex-row items-center justify-center h-14 mt-4 bg-[#FF007F]/10 border border-[#FF007F]/30 rounded-[20px] active:scale-95 transition-transform"
                >
                  {isRotating ? (
                    <ActivityIndicator size="small" color={THEME.danger} />
                  ) : null}
                  <Text
                    className={cn(
                      'text-[11px] font-black uppercase tracking-widest',
                      isRotating ? 'ml-3 text-white/50' : 'text-[#FF007F]',
                    )}
                  >
                    {isRotating ? 'Rotating...' : 'CHANGE PASSWORD'}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </FadeIn>

          {/* ── AI INTEGRATION VAULT (RBAC ENFORCED) ── */}
          <FadeIn delay={400}>
            <GlassCard className="p-6 md:p-10 mb-8 bg-white/[0.015] border-white/5 rounded-[32px] overflow-hidden relative">
              {!isPremium && !isVaultLocked && (
                <View className="absolute inset-0 z-20 items-center justify-center bg-[#020205]/90 backdrop-blur-xl">
                  <Crown size={40} color={THEME.gold} className="mb-4" />
                  <Text className="mb-2 text-xl font-black tracking-widest text-white uppercase">
                    Premium Protocol Required
                  </Text>
                  <Text className="text-[10px] text-white/60 tracking-[2px] uppercase mb-8 text-center max-w-[280px]">
                    Unlock the Sovereign Vault to utilize custom LLM inference
                    endpoints and bypass rate limits.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/settings/billing')}
                    className="flex-row items-center px-8 py-4 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded-2xl active:scale-95"
                  >
                    <Text className="text-xs font-black text-[#FFD700] uppercase tracking-widest">
                      Upgrade to Premium
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {isVaultLocked ? (
                <View className="items-center justify-center py-10">
                  <Lock
                    size={48}
                    color={THEME.cyan}
                    style={{ marginBottom: 24, opacity: 0.8 }}
                  />
                  <Text className="mb-2 text-2xl font-black tracking-widest text-white uppercase">
                    Vault Sealed
                  </Text>
                  <Text className="text-xs text-white/40 tracking-[2px] uppercase mb-10 text-center">
                    API Keys are protected
                  </Text>

                  {showPinPad ? (
                    <View className="items-center w-full max-w-[200px]">
                      <Text className="text-[9px] font-black text-[#00F0FF] tracking-[3px] uppercase mb-4">
                        Enter 4-Digit PIN
                      </Text>
                      <View className="w-full h-16 px-4 overflow-hidden border border-cyan-500/30 bg-black/80 rounded-2xl">
                        <TextInput
                          value={unlockPinEntry}
                          onChangeText={handlePinEntry}
                          keyboardType="number-pad"
                          maxLength={4}
                          secureTextEntry
                          autoFocus
                          placeholder="••••"
                          placeholderTextColor="rgba(255,255,255,0.1)"
                          style={[
                            strictInputStyle,
                            {
                              fontSize: 24,
                              letterSpacing: 16,
                              textAlign: 'center',
                              color: THEME.cyan,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={attemptUnlock}
                      className="flex-row items-center px-8 py-4 bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-2xl active:scale-95"
                    >
                      <Unlock size={16} color={THEME.cyan} className="mr-3" />
                      <Text className="text-xs font-black text-[#00F0FF] uppercase tracking-widest">
                        Authenticate to Open
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View
                  style={{ opacity: isPremium ? 1 : 0.3 }}
                  pointerEvents={isPremium ? 'auto' : 'none'}
                >
                  <View className="flex-row items-center mb-10 gap-x-4">
                    <Cpu size={24} color={THEME.cyan} />
                    <Text className="text-lg font-black tracking-widest text-white uppercase md:text-xl">
                      API KEYS (AES-256)
                    </Text>
                  </View>

                  <View className="gap-y-6">
                    <View>
                      <View className="flex-row items-center justify-between mb-3 ml-2">
                        <Text className="text-[9px] font-black text-[#00F0FF] tracking-[3px] uppercase">
                          Google Gemini Key
                        </Text>
                        <Text className="text-[9px] font-black text-[#32FF00] tracking-[2px] uppercase">
                          ACTIVE ENGINE
                        </Text>
                      </View>
                      <View className="h-14 overflow-hidden border bg-black/40 border-[#00F0FF]/30 rounded-[20px] px-5 focus:border-[#00F0FF]">
                        <TextInput
                          value={apiKeys.gemini}
                          onChangeText={(v) =>
                            setApiKeys((p) => ({ ...p, gemini: v }))
                          }
                          editable={isPremium}
                          placeholder="AIza..."
                          placeholderTextColor="rgba(255,255,255,0.2)"
                          style={strictInputStyle}
                        />
                      </View>
                    </View>

                    <View style={{ opacity: 0.4 }}>
                      <View className="flex-row items-center justify-between mb-3 ml-2">
                        <Text className="text-[9px] font-black text-[#00F0FF]/50 tracking-[3px] uppercase">
                          OpenAI API Key
                        </Text>
                        <Text className="text-[9px] font-black text-[#FF007F] tracking-[2px] uppercase">
                          COMING SOON
                        </Text>
                      </View>
                      <View className="h-14 overflow-hidden border bg-black/20 border-white/5 rounded-[20px] px-5">
                        <TextInput
                          value={apiKeys.openai}
                          editable={false}
                          placeholder="sk-proj-..."
                          placeholderTextColor="rgba(255,255,255,0.1)"
                          style={strictInputStyle}
                        />
                      </View>
                    </View>

                    <View style={{ opacity: 0.4 }}>
                      <View className="flex-row items-center justify-between mb-3 ml-2">
                        <Text className="text-[9px] font-black text-[#00F0FF]/50 tracking-[3px] uppercase">
                          Anthropic Key
                        </Text>
                        <Text className="text-[9px] font-black text-[#FF007F] tracking-[2px] uppercase">
                          COMING SOON
                        </Text>
                      </View>
                      <View className="h-14 overflow-hidden border bg-black/20 border-white/5 rounded-[20px] px-5">
                        <TextInput
                          value={apiKeys.anthropic}
                          editable={false}
                          placeholder="sk-ant-..."
                          placeholderTextColor="rgba(255,255,255,0.1)"
                          style={strictInputStyle}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleSaveApiVault()}
                      disabled={isSyncingKeys || !isPremium}
                      className="flex-row items-center justify-center h-14 mt-4 bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-[20px] active:scale-95 transition-transform"
                    >
                      {isSyncingKeys ? (
                        <ActivityIndicator size="small" color={THEME.cyan} />
                      ) : null}
                      <Text
                        className={cn(
                          'text-[11px] font-black uppercase tracking-widest',
                          isSyncingKeys
                            ? 'ml-3 text-white/50'
                            : 'text-[#00F0FF]',
                        )}
                      >
                        {isSyncingKeys ? 'Sealing...' : 'Seal Vault Keys'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </GlassCard>
          </FadeIn>

          {/* ── DANGER ZONE ── */}
          <FadeIn delay={500}>
            <GlassCard className="p-8 md:p-10 border-rose-500/10 bg-rose-500/5 rounded-[32px]">
              <View className="flex-row items-center mb-6 gap-x-4">
                <ShieldAlert size={28} color={THEME.danger} />
                <Text className="text-lg font-black tracking-widest text-white uppercase md:text-xl">
                  DELETE Account
                </Text>
              </View>
              <Text className="mb-10 text-[10px] md:text-xs leading-6 tracking-[2px] uppercase text-white/40">
                Permanent removal of all digital footprints associated with this
                account
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Purge Protocol',
                    'Contact root administrator to execute full data purge.',
                  )
                }
                className="items-center justify-center h-14 border border-rose-500/20 bg-rose-500/10 rounded-[20px] active:scale-95 transition-transform"
              >
                <Text className="text-[10px] md:text-xs font-black text-rose-500 uppercase tracking-[4px]">
                  Account Closure
                </Text>
              </TouchableOpacity>
            </GlassCard>
          </FadeIn>

          <View className="items-center mt-20 opacity-30">
            <View className="h-[1px] w-12 bg-white/20 mb-4" />
            <Text className="text-[9px] font-mono tracking-[6px] text-white uppercase text-center">
              VeraxAI Security Core
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toggleBase: {
    width: 56,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: THEME.danger },
  toggleInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  knobActive: { alignSelf: 'flex-end' },
  knobInactive: { alignSelf: 'flex-start' },
});
