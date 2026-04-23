/**
 * app/(dashboard)/index.tsx
 * VeraxAI Dashboard — Master Orchestration UI
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL:
 * 1. THE WANDERING CORE: A single, smooth-gliding emitter with solid glowing waves.
 * 2. DEEP NEBULA ENGINE: Soft, massive background blurs for depth.
 * 3. TOUCH SAFETY: 110% APK touch-safe using pointerEvents="none" and zIndex:-1.
 * 4. NATIVE SVG: Bypasses Metro bundler crashes using react-native-svg.
 * 5. EXECUTION NODE: Custom #00C6A2 Liquid Neon execution button mapped to pipeline.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Href, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── STATE & DATA ORCHESTRATION ──────────────────────────────────────────────
import { useVideoStore } from '../../store/useVideoStore';
import { useProcessVideo } from '../../hooks/mutations/useProcessVideo';
import { useVideoData } from '../../hooks/queries/useVideoData';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';

// ─── ANIMATIONS & UTILS ──────────────────────────────────────────────────────
import { FadeIn } from '../../components/animations/FadeIn';
import { ProcessingLoader } from '../../components/ui/ProcessingLoader';
import { cn } from '../../lib/utils';

// ─── NATIVE SVG & REANIMATED PIPELINE ────────────────────────────────────────
import Svg, { Rect, Path, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  Easing,
  withSequence,
  useFrameCallback,
} from 'react-native-reanimated';

// ─── THEME CONSTANTS (Liquid Neon) ───────────────────────────────────────────
const THEME = {
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#800347',
  green: '#008f66',
  transcriber: '#00C6A2', // Primary Execution Color
  obsidian: '#020205',
};

const IS_WEB = Platform.OS === 'web';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: STATIC SVG ASSETS
// ══════════════════════════════════════════════════════════════════════════════

const SmallBadgeIcon = ({ width = 20, height = 20, color = THEME.cyan }) => (
  <Svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
  </Svg>
);

const AnimatedConverter = memo(() => {
  const rotation = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        floatStyle,
        { width: 140, height: 140, alignSelf: 'center', marginVertical: 10 },
      ]}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 10, left: 10, width: 120, height: 120 },
          spinStyle,
        ]}
      >
        <Svg width="60" height="60" viewBox="0 0 60 60">
          <Path
            d="M 30 20 Q 100 20 100 80"
            stroke="#F59E0B"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          <Polygon points="90,70 110,70 100,90" fill="#F59E0B" />
          <Path
            d="M 90 100 Q 20 100 20 40"
            stroke="#F59E0B"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          <Polygon points="10,50 30,50 20,30" fill="#F59E0B" />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Svg width="55" height="65" viewBox="0 0 45 55">
          <Rect x="0" y="0" width="45" height="55" rx="6" fill="#1E3A8A" />
          <Rect x="5" y="5" width="35" height="45" rx="3" fill="#DBEAFE" />
          <Polygon points="25,5 40,5 40,20" fill="#FBBF24" />
        </Svg>
      </View>
      <View style={{ position: 'absolute', bottom: 0, right: -5 }}>
        <Svg width="65" height="50" viewBox="0 0 55 40">
          <Rect x="0" y="0" width="55" height="40" rx="10" fill="#BE185D" />
          <Rect x="4" y="4" width="47" height="32" rx="6" fill="#F472B6" />
          <Polygon points="22,12 22,28 36,20" fill="white" />
        </Svg>
      </View>
    </Animated.View>
  );
});
AnimatedConverter.displayName = 'AnimatedConverter';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: HARDWARE-ACCELERATED AMBIENT ENGINE
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
    }, []);

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

const WanderingCore = memo(
  ({ coreSize, color, maxWaveSize, waveCount, baseDuration }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);
    const stagger = baseDuration / waveCount;

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
              ...(IS_WEB ? ({ boxShadow: `0 0 20px ${color}` } as any) : {}),
            },
          ]}
        />
      </Animated.View>
    );
  },
);
WanderingCore.displayName = 'WanderingCore';

const OrganicOrb = memo(
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

const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  const massiveWaveRadius = isDesktop ? width * 0.4 : height * 1.0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <OrganicOrb
        color={THEME.green}
        size={width * 0.6}
        initialX={width * 0.8}
        initialY={height * 0.6}
        speedX={0.15}
        speedY={0.2}
        phaseOffsetX={Math.PI}
        phaseOffsetY={0}
        opacityBase={0.06}
      />
      <OrganicOrb
        color={THEME.cyan}
        size={width * 0.4}
        initialX={width * 0.5}
        initialY={height * 0.8}
        speedX={0.25}
        speedY={0.1}
        phaseOffsetX={Math.PI / 4}
        phaseOffsetY={Math.PI}
        opacityBase={0.04}
      />
      <WanderingCore
        coreSize={14}
        color={THEME.transcriber}
        maxWaveSize={massiveWaveRadius}
        waveCount={4}
        baseDuration={12000}
      />
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: DASHBOARD UI & INPUT ROUTING
// ══════════════════════════════════════════════════════════════════════════════

interface PipelineStatus {
  text: string;
  progress: string;
  color: string;
  description: string;
  glow: string;
}

interface SystemLog {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 768;

  // Local UI State
  const [videoUrl, setVideoUrl] = useState('');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isUrlValid, setIsUrlValid] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const OUTPUT_LANGUAGES = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Swedish',
    'Russian',
    'Japanese',
    'Korean',
    'Chinese',
    'Arabic',
    'Hindi',
    'Bengali',
    'Turkish',
    'Vietnamese',
    'Polish',
    'Thai',
    'Indonesian',
    'Hebrew',
    'Greek',
    'Czech',
    'Danish',
    'Finnish',
    'Norwegian',
    'Hungarian',
  ];

  const { activeVideoId: currentVideoId, clearState: clearError } =
    useVideoStore();
  const { data: videoData } = useVideoData(currentVideoId);
  const {
    mutateAsync: processVideo,
    isPending,
    error: mutationError,
  } = useProcessVideo();

  const addLog = useCallback(
    (message: string, level: SystemLog['level'] = 'info') => {
      const newLog: SystemLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        message,
        level,
      };
      setLogs((prev) => [newLog, ...prev].slice(0, 8));
      if (Platform.OS !== 'web')
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    },
    [],
  );

  useEffect(() => {
    if (videoData?.status) {
      const statusFormats: Record<string, string> = {
        queued: 'Media queued for processing.',
        downloading: 'Fetching media assets from source.',
        transcribing: 'Transcribing audio track.',
        ai_processing: 'Generating AI summaries and insights.',
        completed: 'Processing complete. Results ready.',
        failed: 'Processing pipeline encountered a critical error.',
      };
      const level =
        videoData.status === 'completed'
          ? 'success'
          : videoData.status === 'failed'
            ? 'error'
            : 'info';
      addLog(
        statusFormats[videoData.status] ||
          `Status updated: ${videoData.status}`,
        level,
      );
    }
  }, [videoData?.status, addLog]);

  const handleProcessVideo = async () => {
    if (!videoUrl.trim()) {
      setIsUrlValid(false);
      addLog('Validation Error: No URL provided.', 'warn');
      return;
    }
    const urlRegex = /^https?:\/\/.+/;
    if (!videoUrl.trim() || !urlRegex.test(videoUrl)) {
      setIsUrlValid(false);
      addLog('Validation Error: Invalid URL format provided.', 'warn');
      return;
    }

    setIsUrlValid(true);
    clearError();
    addLog('Validating source and initiating pipeline...', 'info');

    try {
      const result = await processVideo({
        videoUrl: videoUrl,
        language: selectedLanguage,
      });
      if (result.success) {
        addLog('Pipeline successfully initiated.', 'success');
      } else {
        addLog(result.errorMsg || 'Pipeline initiation failed.', 'error');
      }
    } catch (err: unknown) {
      addLog(
        `Initialization failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  };

  const statusInfo = useMemo((): PipelineStatus | null => {
    if (!videoData && isPending) {
      return {
        text: 'INITIALIZING',
        progress: 'w-1/12',
        color: 'bg-[#00F0FF]',
        description: 'Establishing connection to processing servers...',
        glow: 'shadow-[0_0_15px_rgba(0,240,255,0.4)]',
      };
    }
    if (!videoData?.status) return null;

    const maps: Record<string, PipelineStatus> = {
      queued: {
        text: 'QUEUED',
        progress: 'w-1/5',
        color: 'bg-[#00F0FF]',
        description: 'Waiting for available processing resources.',
        glow: 'shadow-[0_0_15px_rgba(0,240,255,0.4)]',
      },
      downloading: {
        text: 'FETCHING MEDIA',
        progress: 'w-2/5',
        color: 'bg-[#8A2BE2]',
        description: 'Downloading audio and video assets.',
        glow: 'shadow-[0_0_15px_rgba(138,43,226,0.4)]',
      },
      transcribing: {
        text: 'TRANSCRIBING',
        progress: 'w-3/5',
        color: 'bg-[#FF007F]',
        description: 'Converting speech to high-accuracy text.',
        glow: 'shadow-[0_0_15px_rgba(255,0,127,0.4)]',
      },
      ai_processing: {
        text: 'ANALYZING',
        progress: 'w-4/5',
        color: 'bg-[#32FF00]',
        description: 'Generating chapters, summaries, and metadata.',
        glow: 'shadow-[0_0_15px_rgba(50,255,0,0.4)]',
      },
      completed: {
        text: 'COMPLETE',
        progress: 'w-full',
        color: 'bg-[#32FF00]',
        description: 'All tasks finished successfully.',
        glow: 'shadow-[0_0_15px_rgba(50,255,0,0.4)]',
      },
      failed: {
        text: 'FAILED',
        progress: 'w-full',
        color: 'bg-rose-500',
        description: videoData.error_message || 'An unexpected error occurred.',
        glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
      },
    };
    return maps[videoData.status] || null;
  }, [videoData, isPending]);

  const effectivelyLoading = Boolean(
    isPending ||
    (videoData &&
      videoData.status !== 'completed' &&
      videoData.status !== 'failed'),
  );
  const displayError =
    (mutationError as Error)?.message || videoData?.error_message;

  return (
    <SafeAreaView className="flex-1 bg-[#010114]">
      <View
        style={[
          StyleSheet.absoluteFill,
          { pointerEvents: 'none', overflow: 'hidden', zIndex: -1 },
        ]}
      >
        <AmbientArchitecture />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            padding: isMobile ? 20 : 60,
            paddingTop: isMobile ? 120 : 100,
            paddingBottom: isMobile ? 140 : 200,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="justify-center w-full min-h-full">
            <FadeIn>
              <View className="items-center mb-10 md:mb-16">
                <View className="flex-row items-center gap-3 px-4 py-2 mb-4 border rounded-full bg-gradient-to-r from-[#00F0FF]/30 to-[#8A2BE2]/30 border-white/10">
                  <SmallBadgeIcon width={20} height={20} color={THEME.cyan} />
                  <Text className="text-sm font-bold tracking-wide text-[#00F0FF]">
                    VeraxAI Engine 1.0
                  </Text>
                </View>
                <View className="items-center justify-center mb-8">
                  {effectivelyLoading ? (
                    <ProcessingLoader
                      size={isMobile ? 80 : 120}
                      color={THEME.cyan}
                    />
                  ) : (
                    <FadeIn className="items-center justify-center">
                      <AnimatedConverter />
                    </FadeIn>
                  )}
                </View>
                <View className="h-[2px] w-16 md:w-24 bg-[#00F0FF] mt-6 md:mt-8 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.5)]" />
              </View>
            </FadeIn>

            <View className="self-center w-full max-w-2xl px-2">
              <FadeIn delay={200}>
                <GlassCard
                  glowColor="cyan"
                  className={cn(
                    'bg-white/[0.02] border-white/[0.05]',
                    isMobile ? 'p-6' : 'p-10',
                  )}
                >
                  <Input
                    label="MEDIA URL"
                    placeholder="Paste video or audio link here..."
                    value={videoUrl}
                    onChangeText={(v) => {
                      setVideoUrl(v);
                      if (!isUrlValid) setIsUrlValid(true);
                      if (displayError) clearError();
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!effectivelyLoading}
                  />
                  <View className="z-50 mt-8">
                    <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[2px] mb-3">
                      Target Language
                    </Text>

                    {isMobile ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {OUTPUT_LANGUAGES.map((lang) => {
                          const active = lang === selectedLanguage;
                          return (
                            <TouchableOpacity
                              key={lang}
                              onPress={() => setSelectedLanguage(lang)}
                              disabled={effectivelyLoading}
                              hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 5,
                                right: 5,
                              }}
                              className={`px-5 py-2.5 rounded-xl border transition-colors ${active ? 'bg-[#00F0FF]/20 border-[#00F0FF]/50' : 'bg-white/[0.03] border-white/10'}`}
                            >
                              <Text
                                className={`text-xs font-semibold tracking-wide ${active ? 'text-[#00F0FF]' : 'text-white/80'}`}
                              >
                                {lang}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <View className="relative z-50">
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS !== 'web')
                              LayoutAnimation.configureNext(
                                LayoutAnimation.Presets.easeInEaseOut,
                              );
                            setIsDropdownOpen(!isDropdownOpen);
                          }}
                          disabled={effectivelyLoading}
                          className="flex-row items-center justify-between px-5 py-4 border rounded-xl bg-white/[0.05] border-white/10"
                        >
                          <Text className="text-sm font-semibold tracking-wide text-white/80">
                            {selectedLanguage}
                          </Text>
                          <Text className="text-xs text-white/80">
                            {isDropdownOpen ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>

                        {isDropdownOpen && (
                          <View className="absolute w-full mt-2 overflow-hidden border shadow-2xl rounded-xl border-white/30 bg-black/80 backdrop-blur-xl top-full">
                            <ScrollView
                              style={{ maxHeight: 300 }}
                              nestedScrollEnabled
                            >
                              {OUTPUT_LANGUAGES.map((lang) => {
                                const active = lang === selectedLanguage;
                                return (
                                  <TouchableOpacity
                                    key={lang}
                                    onPress={() => {
                                      if (Platform.OS !== 'web')
                                        LayoutAnimation.configureNext(
                                          LayoutAnimation.Presets.easeInEaseOut,
                                        );
                                      setSelectedLanguage(lang);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`px-5 py-3 border-b border-white/[0.02] ${active ? 'bg-[#00F0FF]/10' : ''}`}
                                  >
                                    <Text
                                      className={`text-sm font-medium ${active ? 'text-[#00F0FF]' : 'text-white/70'}`}
                                    >
                                      {lang}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* ─── TRANSCRIBER EXECUTION BUTTON ──────────────────────────────── */}
                  <TouchableOpacity
                    onPress={handleProcessVideo}
                    disabled={effectivelyLoading}
                    className={cn(
                      'items-center justify-center w-full py-5 mt-8 border rounded-xl md:py-6 active:scale-95 transition-transform',
                      effectivelyLoading
                        ? 'bg-white/5 border-white/10'
                        : 'bg-[#00C6A2]/10 border-[#00C6A2]/30 shadow-[0_0_20px_rgba(0,198,162,0.15)]',
                    )}
                  >
                    {effectivelyLoading ? (
                      <View className="flex-row items-center gap-x-3">
                        <ActivityIndicator
                          color={THEME.transcriber}
                          size="small"
                        />
                        <Text className="text-[#00C6A2]/70 text-xs font-black tracking-[4px] uppercase">
                          Transmitting Request...
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-[#00C6A2] text-sm font-black tracking-[4px] uppercase">
                        START TRANSCRIBER
                      </Text>
                    )}
                  </TouchableOpacity>
                  {/* ───────────────────────────────────────────────────────────────── */}

                  {displayError && (
                    <View className="p-5 mt-6 border bg-rose-500/40 border-rose-500/20 rounded-2xl">
                      <Text className="mb-2 text-xs font-bold tracking-widest uppercase text-rose-400">
                        Error Encountered
                      </Text>
                      <Text className="text-sm leading-5 text-rose-300/80">
                        {displayError}
                      </Text>
                    </View>
                  )}

                  {(currentVideoId ||
                    effectivelyLoading ||
                    videoData?.status === 'completed') &&
                    statusInfo && (
                      <View className="pt-8 mt-10 border-t border-white/10">
                        <View className="flex-row justify-between mb-4">
                          <View>
                            <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[2px] mb-1">
                              Current Stage
                            </Text>
                            <Text
                              className={cn(
                                'font-bold text-sm tracking-wider',
                                videoData?.status === 'failed'
                                  ? 'text-rose-400'
                                  : 'text-[#00F0FF]',
                              )}
                            >
                              {statusInfo.text}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[2px] mb-1">
                              Job ID
                            </Text>
                            <Text className="font-mono text-xs uppercase text-white/80">
                              {currentVideoId?.split('-')[0] || 'INIT'}
                            </Text>
                          </View>
                        </View>

                        <View className="w-full h-1.5 mb-4 overflow-hidden rounded-full bg-white/10">
                          <View
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              statusInfo.progress,
                              statusInfo.color,
                              statusInfo.glow,
                            )}
                          />
                        </View>
                        <Text
                          className={cn(
                            'text-xs font-medium',
                            videoData?.status === 'failed'
                              ? 'text-rose-400/80'
                              : 'text-white/80',
                          )}
                        >
                          {statusInfo.description}
                        </Text>

                        {videoData?.status === 'completed' && (
                          <TouchableOpacity
                            onPress={() =>
                              router.push(`/video/${currentVideoId}` as any)
                            }
                            className="items-center justify-center py-4 mt-8 transition-colors border rounded-xl bg-[#32FF00]/10 border-[#32FF00]/30"
                          >
                            <Text className="text-xs font-bold tracking-widest uppercase text-[#32FF00]">
                              View Results
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                </GlassCard>
              </FadeIn>

              <FadeIn delay={400}>
                <View className="mx-2 mt-10">
                  <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[2px] mb-3 ml-2">
                    System Logs
                  </Text>
                  <View className="relative p-5 overflow-hidden border bg-[#020205]/30 border-white/5 rounded-2xl min-h-[120px]">
                    {logs.length === 0 ? (
                      <Text className="mt-6 font-mono text-xs text-center text-white/80">
                        Awaiting input...
                      </Text>
                    ) : (
                      logs.map((log) => (
                        <View key={log.id} className="flex-row mb-2.5">
                          <Text className="text-white/80 font-mono text-[10px] w-20 pt-0.5">
                            {log.timestamp}
                          </Text>
                          <Text
                            className={cn(
                              'font-mono text-xs flex-1 leading-5',
                              log.level === 'info' && 'text-[#00F0FF]/70',
                              log.level === 'warn' && 'text-[#FFD700]',
                              log.level === 'error' && 'text-[#FF007F]',
                              log.level === 'success' && 'text-[#32FF00]',
                            )}
                          >
                            {log.message}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </FadeIn>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View className="absolute items-center justify-center w-full bottom-4">
        <Text className="text-[10px] text-white/80 font-mono">
          &copy; {new Date().getFullYear()} VeraxAI Engine 1.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
