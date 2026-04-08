/**
 * app/(auth)/sign-in.tsx
 * Unified Authentication Screen
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Shield,
  Zap,
  Brain,
  Globe,
  Github,
  Twitter,
  Youtube,
} from 'lucide-react-native';
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
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { AuthValidator } from '../../utils/validators/auth';
import { supabase } from '../../lib/supabase/client';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const APP_ICON = require('../../assets/icon.png');

type AuthMode = 'sign-in' | 'sign-up';

const BENTO_ITEMS = [
  {
    icon: Zap,
    title: 'Lightning Engine',
    desc: 'Process massive media payloads with sub-second latency.',
    color: '#00F0FF',
  },
  {
    icon: Brain,
    title: 'Neural Analysis',
    desc: 'Semantic extraction via Anthropic Claude models.',
    color: '#8A2BE2',
  },
  {
    icon: Globe,
    title: 'Global Nodes',
    desc: 'Access your transcripts from any authenticated endpoint.',
    color: '#00F0FF',
  },
];

function mapAuthError(errorMessage: string): string {
  if (errorMessage.includes('Invalid login credentials'))
    return 'Incorrect email or password.';
  if (errorMessage.includes('User already registered'))
    return 'An account with this email already exists.';
  if (errorMessage.includes('Password should be at least'))
    return 'Password does not meet security requirements.';
  return errorMessage;
}

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
    opacity: interpolate(pulse.value, [0, 1], [0.03, 0.08]),
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
          ...(Platform.OS === 'web' ? { filter: 'blur(120px)' as any } : {}),
        },
      ]}
    />
  );
};

const getPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'WEAK', color: '#FF007F' };
  if (score <= 2) return { score, label: 'FAIR', color: '#FF4500' };
  if (score <= 3) return { score, label: 'GOOD', color: '#00F0FF' };
  return { score, label: 'STRONG', color: '#32FF00' };
};

export default function SignInScreen() {
  const { signInWithPassword, signUp } = useAuthStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const handleAction = useCallback(async () => {
    setMessage(null);
    const trimmedEmail = email.trim();

    if (!AuthValidator.isValidEmail(trimmedEmail)) {
      return setMessage({
        type: 'error',
        text: 'Valid email address required.',
      });
    }

    setLoading(true);

    if (authMode === 'sign-in') {
      const { error } = await signInWithPassword(trimmedEmail, password);
      if (error) {
        setMessage({ type: 'error', text: mapAuthError(error) });
      } else {
        router.replace('/(dashboard)');
      }
    } else {
      if (!fullName.trim()) {
        setLoading(false);
        return setMessage({ type: 'error', text: 'Full name is required.' });
      }
      if (password.length < 8) {
        setLoading(false);
        return setMessage({
          type: 'error',
          text: 'Password must be at least 8 characters.',
        });
      }
      if (password !== confirmPassword) {
        setLoading(false);
        return setMessage({ type: 'error', text: 'Passwords do not match.' });
      }
      if (!agreedToTerms) {
        setLoading(false);
        return setMessage({
          type: 'error',
          text: 'You must accept the Terms of Service.',
        });
      }

      const { error } = await signUp(trimmedEmail, password, fullName.trim());
      if (error) {
        setMessage({ type: 'error', text: mapAuthError(error) });
      } else {
        setMessage({
          type: 'success',
          text: 'Account created. Check your email to verify.',
        });
        setAuthMode('sign-in');
      }
    }
    setLoading(false);
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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setMessage(null);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        path: '/auth/callback',
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
        );
        if (result.type === 'success' && result.url) {
          const urlParams = new URL(result.url);
          const accessToken = result.url.match(/access_token=([^&]*)/)?.[1];
          const refreshToken = result.url.match(/refresh_token=([^&]*)/)?.[1];
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            router.replace('/(dashboard)');
          }
        }
      }
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: mapAuthError(e.message || 'Google Sign In failed'),
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#020205]">
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <NeuralOrb delay={0} color="#00F0FF" />
        <NeuralOrb delay={2500} color="#8A2BE2" />
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
                    username={username}
                    setUsername={setUsername}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    agreedToTerms={agreedToTerms}
                    setAgreedToTerms={setAgreedToTerms}
                    loading={loading}
                    isGoogleLoading={isGoogleLoading}
                    onAction={handleAction}
                    onGoogleAction={handleGoogleSignIn}
                    message={message}
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
                  username={username}
                  setUsername={setUsername}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  agreedToTerms={agreedToTerms}
                  setAgreedToTerms={setAgreedToTerms}
                  loading={loading}
                  isGoogleLoading={isGoogleLoading}
                  onAction={handleAction}
                  onGoogleAction={handleGoogleSignIn}
                  message={message}
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

const BrandHeader = memo(() => (
  <Animated.View
    entering={FadeInDown.duration(1000).springify()}
    style={{ alignItems: 'center', marginBottom: 32 }}
  >
    <Image source={APP_ICON} style={styles.brandIcon} resizeMode="contain" />
  </Animated.View>
));
BrandHeader.displayName = 'BrandHeader';

const FormField = ({ label, icon: Icon, children }: any) => (
  <View style={{ marginBottom: 16 }}>
    <Text className="text-neon-cyan font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
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
    username,
    setUsername,
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
  }: any) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const isSignUp = authMode === 'sign-up';
    const strength = getPasswordStrength(password);
    const passwordsMatch =
      confirmPassword.length > 0 && password === confirmPassword;

    const SlideIn = FadeInRight.springify()
      .damping(18)
      .mass(0.8)
      .stiffness(150);
    const SlideOut = FadeOutUp.duration(150);

    return (
      <View
        style={{
          width: '100%',
          padding: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          layout={Layout.springify().mass(0.6).damping(16).stiffness(120)}
        >
          {/* THIS IS THE FIX: The two buttons are wrapped in flex: 1 containers so they can never be squished */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 4,
              marginBottom: 20,
            }}
          >
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => {
                  setAuthMode('sign-in');
                  setConfirmPassword('');
                  setFullName('');
                }}
                activeOpacity={0.8}
                style={{
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: !isSignUp
                    ? 'rgba(0, 240, 255, 0.3)'
                    : 'transparent',
                  backgroundColor: !isSignUp
                    ? 'rgba(0, 240, 255, 0.1)'
                    : 'transparent',
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontSize: 10,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    color: !isSignUp ? '#00F0FF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  SIGN IN
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => setAuthMode('sign-up')}
                activeOpacity={0.8}
                style={{
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isSignUp
                    ? 'rgba(0, 240, 255, 0.3)'
                    : 'transparent',
                  backgroundColor: isSignUp
                    ? 'rgba(0, 240, 255, 0.1)'
                    : 'transparent',
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontSize: 10,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    color: isSignUp ? '#00F0FF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  SIGN UP
                </Text>
              </TouchableOpacity>
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
                  editable={!loading}
                />
              </FormField>
            </Animated.View>
          )}

          {isSignUp && (
            <Animated.View entering={SlideIn.delay(50)} exiting={SlideOut}>
              <FormField label="Username" icon={AtSign}>
                <TextInput
                  className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                  placeholder="Username"
                  placeholderTextColor="#475569"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loading}
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
              editable={!loading}
            />
          </FormField>

          <View style={{ marginBottom: 16 }}>
            <Text className="text-neon-cyan font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
              PASSWORD
            </Text>
            <View className="bg-white/[0.02] border border-white/10 rounded-2xl h-16 flex-row items-center px-4">
              <Lock size={18} color="#A1A1AA" />
              <TextInput
                className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                placeholder="Min. 8 characters"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
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
                className="px-1 mt-3"
              >
                <View className="flex-row h-1 gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      style={{
                        flex: 1,
                        borderRadius: 99,
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
                    8+ chars, uppercase, number, symbol
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

          {isSignUp && (
            <Animated.View entering={SlideIn.delay(100)} exiting={SlideOut}>
              <Text className="text-neon-cyan font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
                Confirm Security Key
              </Text>
              <View
                className={cn(
                  'border rounded-2xl h-16 flex-row items-center px-4',
                  confirmPassword.length > 0 && !passwordsMatch
                    ? 'border-neon-pink/50'
                    : passwordsMatch
                      ? 'border-neon-lime/50'
                      : 'border-white/10',
                )}
                style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
              >
                <Shield size={18} color="#A1A1AA" />
                <TextInput
                  className="flex-1 h-full ml-3 text-sm font-medium text-white outline-none"
                  placeholder="Re-enter Password"
                  placeholderTextColor="#475569"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  editable={!loading}
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
                  <Text className="font-bold text-neon-cyan">
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text className="font-bold text-neon-cyan">
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {message && (
            <Animated.View
              entering={FadeInDown}
              exiting={SlideOut}
              className={cn(
                'p-4 border rounded-xl mt-2',
                message.type === 'error'
                  ? 'bg-neon-pink/10 border-neon-pink/30'
                  : 'bg-neon-cyan/10 border-neon-cyan/30',
              )}
            >
              <Text
                className={cn(
                  'text-center font-bold text-[10px] tracking-widest uppercase',
                  message.type === 'error'
                    ? 'text-neon-pink'
                    : 'text-neon-cyan',
                )}
              >
                {message.text}
              </Text>
            </Animated.View>
          )}

          <Button
            onPress={onAction}
            isLoading={loading}
            title={
              loading
                ? 'PROCESSING...'
                : isSignUp
                  ? 'CREATE ACCOUNT'
                  : 'SIGN IN'
            }
            className="py-5 mt-4 shadow-lg shadow-neon-cyan/20"
          />

          <View className="flex-row items-center my-6 opacity-30">
            <View className="flex-1 h-[1px] bg-white" />
            <Text className="px-4 text-[10px] font-bold text-white uppercase tracking-widest">
              OR
            </Text>
            <View className="flex-1 h-[1px] bg-white" />
          </View>

          <TouchableOpacity
            onPress={onGoogleAction}
            disabled={isGoogleLoading || loading}
            className="flex-row items-center justify-center py-4 transition-opacity bg-white rounded-xl active:opacity-80"
          >
            <Image
              source={{
                uri: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
              }}
              style={{ width: 18, height: 18, marginRight: 10 }}
            />
            <Text className="text-xs font-bold tracking-wider text-black">
              {isGoogleLoading ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  },
);
AuthForm.displayName = 'AuthForm';

const SecurityFooter = memo(() => (
  <View className="flex-row items-center justify-center mt-10 opacity-40">
    <Text className="text-white/80 text-[9px] font-black tracking-[2px] uppercase">
      End-to-End Encrypted Session
    </Text>
  </View>
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
      <Animated.View
        entering={FadeInRight.duration(1200).springify().delay(200)}
        style={{ marginBottom: 40 }}
      >
        <Text
          className={cn(
            'font-black text-white tracking-tighter uppercase',
            isDesktop ? 'text-6xl leading-[60px]' : 'text-4xl leading-[42px]',
          )}
        >
          Enterprise <Text className="text-neon-cyan">Scale</Text>
        </Text>
        <Text
          className={cn(
            'text-white/50 leading-loose mt-4',
            isDesktop ? 'text-lg' : 'text-sm',
          )}
        >
          Extract Any Videos Audio With The Latest AI
        </Text>
      </Animated.View>

      <View className="flex-col gap-5 mt-4">
        {BENTO_ITEMS.map((item, index) => (
          <Animated.View
            key={item.title}
            entering={FadeInRight.delay(200 + index * 100).springify()}
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
          </Animated.View>
        ))}
      </View>

      <View className="flex-row items-center justify-center gap-10 mt-24 opacity-60">
        <Youtube color="#FFFFFF" size={26} />
        <Twitter color="#FFFFFF" size={26} />
        <Github color="#FFFFFF" size={26} />
      </View>
    </View>
  );
});
MarketingContent.displayName = 'MarketingContent';

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
    zIndex: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  desktopScroll: { flex: 1 },
  desktopScrollContent: { padding: 80, paddingBottom: 150 },
  mobileScroll: { flex: 1 },
  mobileScrollContent: { flexGrow: 1, paddingBottom: 100 },
  mobilePane: { padding: 24, paddingTop: 40 },
  brandIcon: { width: 100, height: 100 },
});
