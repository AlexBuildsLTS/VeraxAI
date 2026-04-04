import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoStore } from '../../store/useVideoStore';
import { useVideoData } from '../../hooks/queries/useVideoData';
import { GlassCard } from '../../components/ui/GlassCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { FadeIn } from '../../components/animations/FadeIn';
import { cn } from '../../lib/utils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

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

const AmbientGradient = ({ delay = 0, color = '#3B82F6' }) => {
  const pulse = useSharedValue(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 10000 }), -1, true),
    );
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.4]) },
      { translateX: interpolate(pulse.value, [0, 1], [0, width * 0.05]) },
      { translateY: interpolate(pulse.value, [0, 1], [0, height * 0.05]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.04, 0.08]),
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          width: width * 1.5,
          height: width * 1.5,
          backgroundColor: color,
          borderRadius: width,
          ...(Platform.OS === 'web' ? { filter: 'blur(140px)' } : {}),
        },
      ]}
    />
  );
};

export default function DashboardScreen() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState('');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isUrlValid, setIsUrlValid] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

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
  ];

  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 768;

  const {
    activeVideoId: currentVideoId,
    isProcessing,
    processNewVideo,
    error: storeError,
    clearError,
  } = useVideoStore();

  const { data: videoData } = useVideoData(currentVideoId);

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
      await processNewVideo(videoUrl, {
        language: selectedLanguage,
        difficulty: 'standard',
      });
      addLog('Pipeline successfully initiated.', 'success');
    } catch (err: any) {
      addLog(`Initialization failed: ${err.message}`, 'error');
    }
  };

  const statusInfo = useMemo((): PipelineStatus | null => {
    if (!videoData && isProcessing) {
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
        color: 'bg-blue-500',
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
  }, [videoData, isProcessing]);

  const effectivelyLoading = Boolean(
    isProcessing ||
    (videoData &&
      videoData.status !== 'completed' &&
      videoData.status !== 'failed'),
  );

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]">
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <AmbientGradient delay={0} color="#3B82F6" />
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
          <FadeIn>
            <View className="items-center mb-10 md:mb-16">
              <View className="px-5 py-1.5 mb-6 border rounded-full bg-blue-500/10 border-blue-500/20">
                <Text className="text-[10px] md:text-xs font-bold tracking-[4px] text-blue-400 uppercase">
                  Transcriber Pro
                </Text>
              </View>

              <Text
                className={cn(
                  'font-black text-white tracking-tight uppercase text-center',
                  isMobile
                    ? 'text-4xl leading-[42px]'
                    : 'text-6xl leading-[64px]',
                )}
              >
                Intelligent <Text className="text-blue-400">Analysis</Text>
              </Text>
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
                    if (storeError) clearError();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!effectivelyLoading}
                />
 {/* OUTPUT LANGUAGE SELECTOR */}
                <View className="mt-8">
                  <Text className="text-white/40 text-[10px] font-semibold uppercase tracking-[2px] mb-3">
                    Target Language
                  </Text>
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
                          className={`px-5 py-2.5 rounded-xl border transition-colors ${
                            active
                              ? 'bg-blue-500/20 border-blue-500/50'
                              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold tracking-wide ${
                              active ? 'text-blue-400' : 'text-white/50'
                            }`}
                          >
                            {lang}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <Button
                  title={
                    effectivelyLoading
                      ? 'PROCESSING REQUEST...'
                      : 'START ANALYSIS'
                  }
                  onPress={handleProcessVideo}
                  isLoading={effectivelyLoading}
                  variant="primary"
                  className="py-5 mt-8 shadow-xl md:py-6 bg-blue-600 hover:bg-blue-500 rounded-xl"
                />

                {storeError && (
                  <View className="p-5 mt-6 border bg-rose-500/10 border-rose-500/20 rounded-2xl">
                    <Text className="text-rose-400 font-bold text-xs tracking-widest uppercase mb-2">
                      Error Encountered
                    </Text>
                    <Text className="text-sm leading-5 text-rose-300/80">
                      {storeError}
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
                          <Text className="text-white/40 text-[10px] font-semibold uppercase tracking-[2px] mb-1">
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
                          <Text className="text-white/40 text-[10px] font-semibold uppercase tracking-[2px] mb-1">
                            Job ID
                          </Text>
                          <Text className="text-white/60 font-mono text-xs uppercase">
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
                            : 'text-white/50',
                        )}
                      >
                        {statusInfo.description}
                      </Text>

                      {videoData?.status === 'completed' && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push(`/video/${currentVideoId}` as any)
                          }
                          className="items-center justify-center py-4 mt-8 border rounded-xl bg-emerald-500/10 border-emerald-500/30 transition-colors hover:bg-emerald-500/20"
                        >
                          <Text className="text-emerald-400 font-bold text-xs tracking-widest uppercase">
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
                <Text className="text-white/40 text-[10px] font-semibold uppercase tracking-[2px] mb-3 ml-2">
                  System Output
                </Text>
                <View className="relative p-5 overflow-hidden border bg-black/20 border-white/5 rounded-2xl min-h-[120px]">
                  <BlurView intensity={20} className="absolute inset-0" />
                  {logs.length === 0 ? (
                    <Text className="text-white/20 font-mono text-xs text-center mt-6">
                      Awaiting input...
                    </Text>
                  ) : (
                    logs.map((log) => (
                      <View key={log.id} className="flex-row mb-2.5">
                        <Text className="text-white/30 font-mono text-[10px] w-20 pt-0.5">
                          {log.timestamp}
                        </Text>
                        <Text
                          className={cn(
                            'font-mono text-xs flex-1 leading-5',
                            log.level === 'info' && 'text-cyan/70',
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
