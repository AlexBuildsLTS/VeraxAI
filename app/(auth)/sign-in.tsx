/**
 * app/(auth)/sign-in.tsx
 * VeraxAI - Authentication Protocol
 * Architecture: Best practices Standards (Web Vercel & Native APK)
 * * ============================================================================
 * MODULE OVERVIEW
 * ============================================================================
 * This file serves a primary entry point for users identity verifications
 * - Multi-Platform OAuth: Native device browser handoff for Google Sign-In and Web redirect
 * - UX STABILIZATION: Added full-screen ProcessingLoader overlay to mask Native OS browser transitions.
 * - ROUTING FIX: Removed invalid callback path to prevent Unmatched Route white screens.
 * - Anti-Flash UX: Reanimated button morphing prevents DOM destruction and keyboard snap
 * - UI Physics: The "Wandering Core" Engine. A single, smooth gliding emitter.
 * - Layout: Desktop split-pane with perfectly centered flex layouts.
 * * ============================================================================
 */

import React, { useState, memo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

// ─── STATE & UTILS ───────────────────────────────────────────────────────────
import { useAuthStore } from '../../store/useAuthStore';
import { cn } from '../../lib/utils';
import { AuthValidator } from '../../utils/validators/auth';
import { supabase } from '../../lib/supabase/client';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// ─── COMPONENTS & ICONS ──────────────────────────────────────────────────────
import { FadeIn as CustomFadeIn } from '../../components/animations/FadeIn';
import { ProcessingLoader } from '../../components/ui/ProcessingLoader';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Circle,
  Shield,
  Zap,
  Brain,
  Github,
  Twitter,
  Youtube,
  Fingerprint,
  Facebook,
  Instagram,
  Twitch,
  Video,
} from 'lucide-react-native';

// ─── ANIMATION ENGINE ────────────────────────────────────────────────────────
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutUp,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  interpolateColor,
  Easing,
  useFrameCallback,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();
const APP_ICON = require('../../assets/icon.png');

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

type AuthMode = 'sign-in' | 'sign-up';
type MessageType = 'error' | 'warning' | 'success';

interface FormFieldProps {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

interface AuthFormProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  fullName: string;
  setFullName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (pw: string) => void;
  confirmPassword: string;
  setConfirmPassword: (pw: string) => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (agreed: boolean) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  isGoogleLoading: boolean;
  onAction: () => Promise<void>;
  onGoogleAction: () => Promise<void>;
  message: { type: MessageType; text: string } | null;
  setMessage: (msg: { type: MessageType; text: string } | null) => void;
  successState: 'none' | 'login' | 'signup';
  router: ReturnType<typeof useRouter>;
}

const BENTO_ITEMS = [
  {
    icon: Zap,
    title: 'Lightning Extraction',
    desc: 'Deepgram Nova-2 STT handles massive audio streams in sub-30s.',
    color: '#00F0FF',
  },
  {
    icon: Brain,
    title: 'Executive AI Engine',
    desc: 'Gemini 3.1 Flash-Lite generates SEO, summaries, and chapters.',
    color: '#8A2BE2',
  },
  {
    icon: Shield,
    title: 'Anti-Block Architecture',
    desc: 'Multi-proxy routing to ensure unstoppable reliability.',
    color: '#00F0FF',
  },
];

function mapAuthError(errorMessage: string): {
  type: MessageType;
  text: string;
} {
  if (!errorMessage)
    return { type: 'error', text: 'An unknown error occurred.' };
  const lowMsg = errorMessage.toLowerCase();

  if (
    lowMsg.includes('user already registered') ||
    lowMsg.includes('already exists')
  )
    return {
      type: 'warning',
      text: 'This email is already registered. Please sign in.',
    };
  if (lowMsg.includes('password should be at least'))
    return {
      type: 'warning',
      text: 'Your password must be at least 10 characters long.',
    };
  if (lowMsg.includes('rate limit'))
    return {
      type: 'warning',
      text: 'Too many attempts. Please wait a moment and try again.',
    };
  if (lowMsg.includes('email not confirmed'))
    return {
      type: 'warning',
      text: 'Account pending verification. Please check your inbox.',
    };
  if (lowMsg.includes('invalid login credentials'))
    return {
      type: 'error',
      text: 'Incorrect email or password. Please try again.',
    };
  if (lowMsg.includes('network') || lowMsg.includes('fetch'))
    return {
      type: 'error',
      text: 'Network failed. Please check your internet connection.',
    };
  if (lowMsg.includes('unexpected_failure') || lowMsg.includes('500'))
    return {
      type: 'error',
      text: 'System fault: Database error on the server.',
    };

  return { type: 'error', text: errorMessage };
}

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

    const animatedStyle = useAnimatedStyle(() => ({
      width: interpolate(progress.value, [0, 1], [0, maxSize]),
      height: interpolate(progress.value, [0, 1], [0, maxSize]),
      borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
      opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 0.4, 0.05, 0]),
      borderWidth: interpolate(progress.value, [0, 1], [24, 2]),
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

const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  const massiveWaveRadius = isDesktop ? width * 1.0 : height * 1.4;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WanderingCore
        coreSize={18}
        color="#00F0FF"
        maxWaveSize={massiveWaveRadius}
        waveCount={4}
        baseDuration={16000}
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: MAIN SCREEN COMPONENT & AUTH ROUTING
// ══════════════════════════════════════════════════════════════════════════════

export default function SignInScreen() {
  const { signInWithPassword, signUp } = useAuthStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [successState, setSuccessState] = useState<'none' | 'login' | 'signup'>(
    'none',
  );
  const [message, setMessage] = useState<{
    type: MessageType;
    text: string;
  } | null>(null);

  const handleAction = useCallback(async () => {
    setMessage(null);
    const trimmedEmail = email.trim();
    setLoading(true);

    if (authMode === 'sign-in') {
      const validation = AuthValidator.validateSignIn(trimmedEmail, password);
      if (!validation.valid) {
        setLoading(false);
        return setMessage({
          type: 'error',
          text: validation.error || 'Invalid input.',
        });
      }

      const { error } = await signInWithPassword(trimmedEmail, password);

      if (error) {
        setMessage(mapAuthError(error));
        setLoading(false);
      } else {
        setLoading(false);
        setSuccessState('login');
        setTimeout(() => {
          router.replace('/(dashboard)');
        }, 1500);
      }
    } else {
      if (!agreedToTerms) {
        setLoading(false);
        return setMessage({
          type: 'warning',
          text: 'You must agree to the Terms of Service and Privacy Policy.',
        });
      }

      const validation = AuthValidator.validateSignUp(
        trimmedEmail,
        password,
        confirmPassword,
        fullName,
      );
      if (!validation.valid) {
        setLoading(false);
        return setMessage({
          type: 'error',
          text: validation.error || 'Invalid input.',
        });
      }

      const { error } = await signUp(trimmedEmail, password, fullName.trim());

      if (error) {
        setMessage(mapAuthError(error));
        setLoading(false);
      } else {
        setLoading(false);
        setSuccessState('signup');
        setTimeout(() => {
          setSuccessState('none');
          setAuthMode('sign-in');
          setPassword('');
          setConfirmPassword('');
          setMessage({
            type: 'success',
            text: 'Account created successfully. Please sign in.',
          });
        }, 2000);
      }
    }
  }, [
    authMode,
    fullName,
    email,
    password,
    confirmPassword,
    agreedToTerms,
    signInWithPassword,
    signUp,
    router,
  ]);

  // ══════════════════════════════════════════════════════════════════════════════
  // NATIVE GOOGLE OAUTH FIXES APPLIED HERE
  // ══════════════════════════════════════════════════════════════════════════════
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setMessage(null);
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        return;
      }

      // 1. CRITICAL FIX: Removed the `path: 'auth/callback'` to prevent the
      // Expo Router "Unmatched Route" blank white screen. Safely targets root.
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'veraxai',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data?.url)
        throw new Error('OAuth Portal URL could not be generated.');

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
      );

      // 2. CRITICAL FIX: Explicitly handle the 'cancel' state so the user doesn't
      // get permanently stuck on a loading screen, requiring a "double login"
      if (result.type === 'success' && result.url) {
        const urlParts = result.url.split('#');
        const hashParams = urlParts[1];
        const queryParams = result.url.split('?')[1];
        const params = new URLSearchParams(hashParams || queryParams || '');

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) throw sessionError;

          await useAuthStore.getState().refreshProfile();

          setIsGoogleLoading(false);
          setSuccessState('login');
          setTimeout(() => {
            router.replace('/(dashboard)');
          }, 1500);
        } else {
          throw new Error(
            'Verification failed: Handshake tokens were not returned.',
          );
        }
      } else {
        // User closed the browser or OS rejected intent. Reset loading securely.
        setIsGoogleLoading(false);
      }
    } catch (e: any) {
      console.error('[VeraxAI Auth Fault]', e);
      setMessage({
        type: 'error',
        text: e.message || 'Identity link failed. Please try again.',
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#000016]">
      {/* 3. CRITICAL VISUAL FIX: Full-screen overlay to perfectly mask the OS browser handoff */}
      {isGoogleLoading && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0,0,22,0.95)',
              zIndex: 9999,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <ProcessingLoader size={100} color="#00F0FF" />
          <Text className="text-[#00F0FF] text-[10px] font-black tracking-[4px] uppercase mt-8">
            Authenticating...
          </Text>
        </Animated.View>
      )}

      {/* ── AMBIENT GLIDING CORE ENGINE ── */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { pointerEvents: 'none', overflow: 'hidden' },
        ]}
      >
        <AmbientArchitecture />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {isDesktop ? (
            <View style={styles.desktopContainer}>
              <View style={styles.desktopSidebar}>
                <ScrollView
                  style={{ flex: 1, width: '100%' }}
                  contentContainerStyle={{
                    maxWidth: 440,
                    alignSelf: 'center',
                    paddingVertical: 40,
                    flexGrow: 1,
                    justifyContent: 'center',
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <BrandHeader />
                  <AuthForm
                    authMode={authMode}
                    setAuthMode={setAuthMode}
                    fullName={fullName}
                    setFullName={setFullName}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    agreedToTerms={agreedToTerms}
                    setAgreedToTerms={setAgreedToTerms}
                    loading={loading}
                    setLoading={setLoading}
                    isGoogleLoading={isGoogleLoading}
                    onAction={handleAction}
                    onGoogleAction={handleGoogleSignIn}
                    message={message}
                    setMessage={setMessage}
                    successState={successState}
                    router={router}
                  />
                  <SecurityFooter />
                </ScrollView>
              </View>
              <ScrollView
                style={styles.desktopScroll}
                contentContainerStyle={styles.desktopScrollContent}
              >
                <MarketingContent isDesktop={true} />
              </ScrollView>
            </View>
          ) : (
            <ScrollView
              style={styles.mobileScroll}
              contentContainerStyle={styles.mobileScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.mobilePane}>
                <BrandHeader />
                <AuthForm
                  authMode={authMode}
                  setAuthMode={setAuthMode}
                  fullName={fullName}
                  setFullName={setFullName}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  agreedToTerms={agreedToTerms}
                  setAgreedToTerms={setAgreedToTerms}
                  loading={loading}
                  setLoading={setLoading}
                  isGoogleLoading={isGoogleLoading}
                  onAction={handleAction}
                  onGoogleAction={handleGoogleSignIn}
                  message={message}
                  setMessage={setMessage}
                  successState={successState}
                  router={router}
                />
                <SecurityFooter />
              </View>
              <View className="h-[2px] bg-white/5 my-12 mx-8" />
              <View style={styles.mobilePane}>
                <MarketingContent isDesktop={false} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const BrandHeader = memo(() => (
  <Animated.View
    entering={FadeInDown.duration(1000).springify()}
    style={{ alignItems: 'center', marginBottom: 32 }}
  >
    <Image source={APP_ICON} style={styles.brandIcon} resizeMode="contain" />
  </Animated.View>
));
BrandHeader.displayName = 'BrandHeader';

const FormField = ({ label, icon: Icon, children }: FormFieldProps) => (
  <View style={{ marginBottom: 16 }}>
    <Text className="text-[#00F0FF] font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
      {label}
    </Text>
    <View className="bg-white/[0.02] border border-white/10 rounded-2xl h-16 flex-row items-center px-4">
      <Icon size={18} color="#A1A1AA" />
      {children}
    </View>
  </View>
);

const AuthForm = memo(
  ({
    authMode,
    setAuthMode,
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    agreedToTerms,
    setAgreedToTerms,
    loading,
    isGoogleLoading,
    onAction,
    onGoogleAction,
    message,
    successState,
  }: AuthFormProps) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const isSignUp = authMode === 'sign-up';

    const strength = password
      ? AuthValidator.validatePassword(password).valid
        ? { score: 4, label: 'STRONG', color: '#32FF00' }
        : { score: 1, label: 'WEAK', color: '#FF007F' }
      : { score: 0, label: '', color: 'transparent' };

    const passwordsMatch =
      confirmPassword.length > 0 && password === confirmPassword;
    const SlideIn = FadeInRight.springify().damping(20).mass(1).stiffness(140);
    const SlideOut = FadeOutUp.duration(200);
    const buttonColor = useSharedValue(0);

    useEffect(() => {
      if (successState !== 'none' || message?.type === 'success') {
        buttonColor.value = withTiming(1, { duration: 300 });
      } else if (message?.type === 'error') {
        buttonColor.value = withTiming(2, { duration: 300 });
      } else if (message?.type === 'warning') {
        buttonColor.value = withTiming(3, { duration: 300 });
      } else {
        buttonColor.value = withTiming(0, { duration: 300 });
      }
    }, [successState, message]);

    const animatedButtonStyle = useAnimatedStyle(() => {
      const backgroundColor = interpolateColor(
        buttonColor.value,
        [0, 1, 2, 3],
        [
          'rgba(0, 240, 255, 0.1)',
          'rgba(50, 255, 0, 0.15)',
          'rgba(244, 63, 94, 0.1)',
          'rgba(245, 158, 11, 0.1)',
        ],
      );
      const borderColor = interpolateColor(
        buttonColor.value,
        [0, 1, 2, 3],
        [
          'rgba(0, 240, 255, 0.3)',
          'rgba(50, 255, 0, 0.5)',
          'rgba(244, 63, 94, 0.4)',
          'rgba(245, 158, 11, 0.4)',
        ],
      );
      return { backgroundColor, borderColor };
    });

    return (
      <Animated.View
        layout={Layout.springify().damping(20).stiffness(150)}
        style={styles.formContainer}
      >
        {successState !== 'none' ? (
          <Animated.View
            entering={FadeInDown.duration(400)}
            exiting={FadeOutUp.duration(300)}
            style={{
              paddingVertical: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={80} color="#32FF00" />
            <Text className="text-[#32FF00] text-lg font-black uppercase tracking-widest mt-6 text-center">
              {successState === 'login' ? 'Access Granted' : 'Account Created'}
            </Text>
            <Text className="text-white/50 text-[10px] uppercase tracking-widest mt-2 text-center">
              {successState === 'login'
                ? 'Synchronizing workspace...'
                : 'Preparing secure connection...'}
            </Text>
          </Animated.View>
        ) : (
          <>
            <View className="mb-6">
              <View style={styles.tabContainer}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMode('sign-in');
                      setConfirmPassword('');
                      setFullName('');
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.tabButton,
                      !isSignUp ? styles.tabActive : styles.tabInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        !isSignUp
                          ? styles.tabTextActive
                          : styles.tabTextInactive,
                      ]}
                    >
                      SIGN IN
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => setAuthMode('sign-up')}
                    activeOpacity={0.8}
                    style={[
                      styles.tabButton,
                      isSignUp ? styles.tabActive : styles.tabInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        isSignUp
                          ? styles.tabTextActive
                          : styles.tabTextInactive,
                      ]}
                    >
                      SIGN UP
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {isSignUp && (
              <Animated.View entering={SlideIn} exiting={SlideOut}>
                <FormField label="Full Name" icon={User}>
                  <TextInput
                    className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                    placeholder="John Doe"
                    placeholderTextColor="#475569"
                    value={fullName}
                    onChangeText={setFullName}
                    editable={!loading && successState === 'none'}
                  />
                </FormField>
              </Animated.View>
            )}

            <FormField label="Email" icon={Mail}>
              <TextInput
                className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                placeholder="Enter Your Address"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading && successState === 'none'}
                autoCorrect={false}
              />
            </FormField>

            <View style={{ marginBottom: isSignUp ? 12 : 0 }}>
              <Text className="text-[#00F0FF] font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
                PASSWORD
              </Text>
              <View className="bg-white/[0.02] border border-white/10 rounded-2xl h-16 flex-row items-center px-4">
                <Lock size={18} color="#A1A1AA" />
                <TextInput
                  className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                  placeholder="Min. 10 characters"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading && successState === 'none'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#A1A1AA" />
                  ) : (
                    <Eye size={18} color="#A1A1AA" />
                  )}
                </TouchableOpacity>
              </View>
              {isSignUp && password.length > 0 && (
                <Animated.View
                  entering={FadeInDown}
                  exiting={SlideOut}
                  className="px-1 mt-4"
                >
                  <View className="flex-row h-1 gap-1 mb-2">
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={{
                          flex: 4,
                          borderRadius: 80,
                          backgroundColor:
                            strength.score >= level
                              ? strength.color
                              : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/20 text-[8px] font-mono uppercase tracking-widest">
                      uppercase, number, symbol
                    </Text>
                    <Text
                      style={{ color: strength.color }}
                      className="text-[8px] font-black uppercase tracking-widest"
                    >
                      {strength.label}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>

            {!isSignUp && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={{
                  alignItems: 'flex-end',
                  marginTop: 12,
                  marginBottom: 12,
                }}
              >
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text className="text-[#00F0FF] text-[11px] items-center my-3 ml-1 font-bold tracking-widest uppercase hover:text-white transition-colors">
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {isSignUp && (
              <Animated.View entering={SlideIn.delay(100)} exiting={SlideOut}>
                <Text className="text-[#00F0FF] font-black text-[10px] tracking-widest uppercase mb-2 ml-1 mt-2">
                  Confirm PASSWORD
                </Text>
                <View
                  className={cn(
                    'border rounded-2xl h-16 flex-row items-center px-4',
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-rose-500/50'
                      : passwordsMatch
                        ? 'border-[#32FF00]/50'
                        : 'border-white/10',
                  )}
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <Fingerprint size={18} color="#A1A1AA" />
                  <TextInput
                    className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                    placeholder="Re-enter Password"
                    placeholderTextColor="#475569"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    editable={!loading && successState === 'none'}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setAgreedToTerms(!agreedToTerms)}
                  className="flex-row items-start gap-3 mt-4 mb-2"
                  activeOpacity={0.7}
                >
                  {agreedToTerms ? (
                    <CheckCircle2 size={20} color="#00F0FF" />
                  ) : (
                    <Circle size={20} color="rgba(255,255,255,0.2)" />
                  )}
                  <Text className="flex-1 text-white/40 text-[11px] leading-5">
                    I agree to the{' '}
                    <Text className="font-bold text-[#00F0FF]">
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text className="font-bold text-[#00F0FF]">
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {message && successState === 'none' && (
              <Animated.View
                entering={FadeInDown.springify()}
                exiting={FadeOutUp}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  marginTop: 24,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor:
                    message.type === 'error'
                      ? 'rgba(244, 63, 94, 0.1)'
                      : message.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)',
                  borderColor:
                    message.type === 'error'
                      ? 'rgba(244, 63, 94, 0.3)'
                      : message.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(16, 185, 129, 0.3)',
                }}
              >
                <View style={{ marginRight: 12 }}>
                  {message.type === 'error' && (
                    <AlertCircle size={18} color="#F43F5E" />
                  )}
                  {message.type === 'warning' && (
                    <AlertTriangle size={18} color="#F59E0B" />
                  )}
                  {message.type === 'success' && (
                    <CheckCircle2 size={18} color="#10B981" />
                  )}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: '500',
                    color:
                      message.type === 'error'
                        ? '#F43F5E'
                        : message.type === 'warning'
                          ? '#F59E0B'
                          : '#10B981',
                  }}
                >
                  {message.text}
                </Text>
              </Animated.View>
            )}

            <Animated.View
              style={[
                animatedButtonStyle,
                { borderRadius: 20, borderWidth: 1, marginTop: 16 },
              ]}
            >
              <TouchableOpacity
                onPress={onAction}
                disabled={loading || successState !== 'none'}
                activeOpacity={0.8}
                className="flex-row items-center justify-center h-[60px]"
              >
                {loading ? (
                  <ActivityIndicator color="#00F0FF" />
                ) : (
                  <Text className="text-base font-black tracking-widest text-[#00F0FF] uppercase">
                    {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View
              pointerEvents={successState !== 'none' ? 'none' : 'auto'}
              style={{ opacity: successState !== 'none' ? 0.5 : 1 }}
            >
              <View className="flex-row items-center my-6 opacity-30">
                <View className="flex-1 h-[1px] bg-cyan-500" />
                <Text className="px-4 text-[14px] font-bold text-cyan-500 uppercase tracking-widest">
                  VerAI
                </Text>
                <View className="flex-1 h-[1px] bg-cyan-500" />
              </View>

              <TouchableOpacity
                onPress={onGoogleAction}
                disabled={isGoogleLoading || loading || successState !== 'none'}
                activeOpacity={0.7}
                className="flex-row items-center justify-center py-4 mb-3 transition-opacity bg-white border rounded-xl border-white/20"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Image
                      source={require('../../assets/google-logo.png')}
                      style={{ width: 18, height: 18, marginRight: 10 }}
                    />
                    <Text className="text-xs font-bold tracking-widest text-black uppercase">
                      SIGN IN GOOGLE
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>
    );
  },
);
AuthForm.displayName = 'AuthForm';

const SecurityFooter = memo(() => (
  <CustomFadeIn
    delay={400}
    duration={800}
    translateYStart={10}
    className="flex-row items-center justify-center mt-10 opacity-40"
    children={undefined}
  ></CustomFadeIn>
));
SecurityFooter.displayName = 'SecurityFooter';

const MarketingContent = memo(({ isDesktop }: { isDesktop: boolean }) => {
  return (
    <View
      style={{
        width: '100%',
        paddingBottom: 60,
        paddingHorizontal: isDesktop ? 0 : 16,
      }}
    >
      <View className="flex-col gap-5 mt-4">
        {BENTO_ITEMS.map((item, index) => (
          <CustomFadeIn
            key={item.title}
            delay={200 + index * 150}
            duration={800}
            translateYStart={30}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              className="p-6 border rounded-3xl border-white/10"
              style={{ backgroundColor: 'rgba(5, 5, 10, 0.6)' }}
            >
              <View className="flex-row items-center gap-4 mb-2">
                <View
                  className="items-center justify-center w-10 h-10 rounded-xl"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <item.icon size={18} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black tracking-wide text-white uppercase">
                    {item.title}
                  </Text>
                  <Text className="text-white/40 text-[10px] font-mono uppercase tracking-widest leading-4 mt-1">
                    {item.desc}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </CustomFadeIn>
        ))}
      </View>
      <CustomFadeIn delay={800} duration={800} translateYStart={15}>
        <View style={styles.socialIconsContainer}>
          <Youtube color="#FFFFFF" size={26} />
          <Twitter color="#FFFFFF" size={26} />
          <Github color="#FFFFFF" size={26} />
          <Facebook color="#FFFFFF" size={26} />
          <Instagram color="#FFFFFF" size={26} />
          <Twitch color="#FFFFFF" size={26} />
          <Video color="#FFFFFF" size={26} />
        </View>
      </CustomFadeIn>
    </View>
  );
});
MarketingContent.displayName = 'MarketingContent';

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  desktopContainer: { flexDirection: 'row', flex: 1 },
  desktopSidebar: {
    width: '40%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  desktopScroll: { flex: 1 },
  desktopScrollContent: {
    padding: 80,
    paddingBottom: 150,
    flexGrow: 1,
    justifyContent: 'center',
  },
  mobileScroll: { flex: 1 },
  mobileScrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 500,
  },
  mobilePane: { padding: 24, paddingTop: 40 },
  brandIcon: { width: 100, height: 100 },
  formContainer: {
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabActive: {
    borderColor: 'rgba(0, 240, 255, 0.3)',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  tabInactive: { borderColor: 'transparent', backgroundColor: 'transparent' },
  tabText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  tabTextActive: { color: '#00F0FF' },
  tabTextInactive: { color: 'rgba(255,255,255,0.4)' },
  socialIconsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
    marginTop: 96,
    opacity: 0.6,
  },
});
