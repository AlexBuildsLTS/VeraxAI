/**
 * app/(dashboard)/index.tsx
 * VerAI Dashboard
 * ----------------------------------------------------------------------------
 * NATIVE SVG: Bypasses Metro bundler crashes using react-native-svg.
 * TANSTACK MUTATION: Securely dispatches payloads via useProcessVideo hook.
 * REALTIME DB SYNC: Listens to the `videos` table for live pipeline updates.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// State & API
import { useVideoStore } from '../../store/useVideoStore';
import { useProcessVideo } from '../../hooks/mutations/useProcessVideo';
import { useVideoData } from '../../hooks/queries/useVideoData';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';

// Animations
import { FadeIn } from '../../components/animations/FadeIn';
import { ProcessingLoader } from '../../components/ui/ProcessingLoader';
import { cn } from '../../lib/utils';

// Native SVG & Animation
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
} from 'react-native-reanimated';

// ─── SMALL BADGE ICON ────────────────────────────────────────────────────────
const SmallBadgeIcon = ({ width = 20, height = 20, color = '#60A5FA' }) => (
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

// ─── ANIMATED HERO SVG ───────────────────────────────────────────────────────
const AnimatedConverter = () => {
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
  }, [rotation, floatY]);

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
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT BACKGROUND ENGINE (Restored 3-Color Glow & Fixed Edges)
// ══════════════════════════════════════════════════════════════════════════════
const AmbientGradient = ({
  delay = 0,
  color = '#00081a',
  size,
  top,
  left,
  right,
  bottom,
}: any) => {
  const pulse = useSharedValue(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 9000 }), -1, true),
    );
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [0.8, 1.8]) },
      { translateX: interpolate(pulse.value, [0, 1], [0, width * 0.3]) },
      { translateY: interpolate(pulse.value, [0, 1], [0, height * 0.5]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.02, 0.04]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        animatedStyle,

        {
          position: 'absolute',

          width: width * 0.35,

          height: width * 0.35,

          backgroundColor: color,

          borderRadius: width,
        },
      ]}
    />
  );
};

const AmbientEngine = React.memo(() => (
  <>
    <AmbientGradient delay={500} color="#341539" right={-150} left={-100} />
    <AmbientGradient delay={4000} color="#8B5CF6" top={-100} right={-150} />
    <AmbientGradient delay={8000} color="#2003fc" bottom={-150} left={-125} />
  </>
));

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

  // We use store ONLY for the active ID to track progress
  const { activeVideoId: currentVideoId, clearState: clearError } =
    useVideoStore();

  // Real-time data for the progress bar
  const { data: videoData } = useVideoData(currentVideoId);

  // The actual Engine Trigger
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
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    },
    [],
  );

  // ─── PIPELINE STATUS MONITORING
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
        color: 'bg-blue-400',
        description: 'Establishing connection to processing servers...',
        glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]',
      };
    }

    if (!videoData?.status) return null;

    const maps: Record<string, PipelineStatus> = {
      queued: {
        text: 'QUEUED',
        progress: 'w-1/5',
        color: 'bg-cyan-500',
        description: 'Waiting for available processing resources.',
        glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
      },
      downloading: {
        text: 'FETCHING MEDIA',
        progress: 'w-2/5',
        color: 'bg-indigo-500',
        description: 'Downloading audio and video assets.',
        glow: 'shadow-[0_0_15px_rgba(99,102,241,0.4)]',
      },
      transcribing: {
        text: 'TRANSCRIBING',
        progress: 'w-3/5',
        color: 'bg-violet-500',
        description: 'Converting speech to high-accuracy text.',
        glow: 'shadow-[0_0_15px_rgba(139,92,246,0.4)]',
      },
      ai_processing: {
        text: 'ANALYZING',
        progress: 'w-4/5',
        color: 'bg-purple-500',
        description: 'Generating chapters, summaries, and metadata.',
        glow: 'shadow-[0_0_15px_rgba(168,85,247,0.4)]',
      },
      completed: {
        text: 'COMPLETE',
        progress: 'w-full',
        color: 'bg-emerald-500',
        description: 'All tasks finished successfully.',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
      },
      failed: {
        text: 'FAILED',
        progress: 'w-full',
        color: 'bg-rose-500',
        description:
          videoData.error_message ||
          'An unexpected error occurred during processing.',
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
    <SafeAreaView className="flex-1 bg-[#01031fbe]">
      {/* ── AMBIENT ORB DEPLOYMENT ── */}
      <View
        className="absolute inset-0 overflow-hidden"
        style={{ pointerEvents: 'none' }}
      >
        <AmbientEngine />
        <AmbientGradient delay={0.5} color="#3B82F6" />
        <AmbientGradient delay={3000} color="#8B5CF6" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            padding: isMobile ? 20 : 60,
            paddingTop: isMobile ? 140 : 100,
            paddingBottom: isMobile ? 140 : 200,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="justify-center w-full min-h-full">
            <FadeIn>
              <View className="items-center mb-10 md:mb-16">
                <View className="flex-row items-center gap-3 px-4 py-2 mb-4 border rounded-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 border-white/10">
                  <SmallBadgeIcon width={20} height={20} color="#60A5FA" />
                  <Text className="text-sm font-bold tracking-wide text-blue-400">
                    VeraxAI Engine 1.0
                  </Text>
                </View>

                <View className="items-center justify-center mb-8">
                  {effectivelyLoading ? (
                    <ProcessingLoader
                      size={isMobile ? 80 : 120}
                      color="#60A5FA"
                    />
                  ) : (
                    <FadeIn className="items-center justify-center">
                      <AnimatedConverter />
                    </FadeIn>
                  )}
                </View>

                <View className="h-[2px] w-16 md:w-24 bg-blue-500 mt-6 md:mt-8 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
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
                              className={`px-5 py-2.5 rounded-xl border transition-colors ${
                                active
                                  ? 'bg-blue-500/20 border-blue-500/50'
                                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                              }`}
                            >
                              <Text
                                className={`text-xs font-semibold tracking-wide ${
                                  active ? 'text-blue-400' : 'text-white/80'
                                }`}
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
                            if (Platform.OS !== 'web') {
                              LayoutAnimation.configureNext(
                                LayoutAnimation.Presets.easeInEaseOut,
                              );
                            }
                            setIsDropdownOpen(!isDropdownOpen);
                          }}
                          disabled={effectivelyLoading}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          className="flex-row items-center justify-between px-5 py-4 border rounded-xl bg-white/[0.05] border-white/10 hover:bg-white/[0.08]"
                        >
                          <Text className="text-sm font-semibold tracking-wide text-white/80">
                            {selectedLanguage}
                          </Text>
                          <Text className="text-xs text-white/80">
                            {isDropdownOpen ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>

                        {isDropdownOpen && (
                          <View className="absolute w-full mt-2 overflow-hidden border shadow-2xl rounded-xl border-white/30 bg-black/30 backdrop-blur-xl top-full">
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
                                      if (Platform.OS !== 'web') {
                                        LayoutAnimation.configureNext(
                                          LayoutAnimation.Presets.easeInEaseOut,
                                        );
                                      }
                                      setSelectedLanguage(lang);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`px-5 py-3 border-b border-white/[0.02] ${
                                      active
                                        ? 'bg-blue-500/10'
                                        : 'hover:bg-white/[0.05]'
                                    }`}
                                  >
                                    <Text
                                      className={`text-sm font-medium ${
                                        active
                                          ? 'text-blue-400'
                                          : 'text-white/70'
                                      }`}
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

                  <Button
                    title={
                      effectivelyLoading
                        ? 'TRANSMITTING REQUEST...'
                        : 'START TRANSCRIBER'
                    }
                    onPress={handleProcessVideo}
                    isLoading={effectivelyLoading}
                    variant="primary"
                    className="py-5 mt-8 bg-blue-600 shadow-xl md:py-6 hover:bg-blue-500 rounded-xl"
                  />

                  {displayError && (
                    <View className="p-5 mt-6 border bg-rose-500/10 border-rose-500/20 rounded-2xl">
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
                                  : 'text-blue-400',
                              )}
                            >
                              {statusInfo.text}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[2px] mb-1">
                              Job ID
                            </Text>
                            <Text className="font-mono text-xs uppercase text-white/60">
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
                            className="items-center justify-center py-4 mt-8 transition-colors border rounded-xl bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                          >
                            <Text className="text-xs font-bold tracking-widest uppercase text-emerald-400">
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
                  <View className="relative p-5 overflow-hidden border bg-[#1d1d49]/60 border-white/5 rounded-2xl min-h-[120px]">
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
                              log.level === 'info' && 'text-cyan-400/70',
                              log.level === 'warn' && 'text-amber-400',
                              log.level === 'error' && 'text-rose-400',
                              log.level === 'success' && 'text-emerald-400',
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
          &copy; {new Date().getFullYear()} VerAI All rights reserved
        </Text>
      </View>
    </SafeAreaView>
  );
}
