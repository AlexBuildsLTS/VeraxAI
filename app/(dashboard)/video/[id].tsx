/**
 * app/(dashboard)/video/[id].tsx
 * Master Intelligence View - Enterprise Fix
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useVideoData } from '../../../hooks/queries/useVideoData';
import { GlassCard } from '../../../components/ui/GlassCard';
import { TranscriptViewer } from '../../../components/domain/TranscriptViewer';
import { FadeIn } from '../../../components/animations/FadeIn';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Sparkles,
  Clock,
  Copy,
  Share2,
  AlertCircle,
  FileText,
  Download,
  Terminal,
  Layers,
  Zap,
  Target,
  ChevronRight,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { ExportBuilder } from '../../../services/exportBuilder';
import { cn } from '../../../lib/utils';
import {
  Video,
  Transcript,
  AiInsights,
  TranscriptSegment,
  Chapter,
} from '../../../types/api';

export default function VideoResultScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 768;

  const { data: videoData, isLoading, error } = useVideoData(id as string);

  // Background Pulse
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 6000 }), -1, true);
  }, [pulse]);

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.02, 0.07]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  // --- TYPE FIXES: Using unknown as bridge to resolve overlap errors ---
  const insights = videoData?.ai_insights;
  const mainTranscript = videoData?.transcripts?.[0];

  const chapters = useMemo(
    () => (insights?.chapters as unknown as Chapter[]) || [],
    [insights],
  );

  const takeaways = useMemo(
    () => (insights?.key_takeaways as unknown as string[]) || [],
    [insights],
  );

  const isAiProcessing = videoData?.status === 'ai_processing';
  const isCompleted = videoData?.status === 'completed';

  const handleExport = async (
    format: 'txt' | 'srt' | 'vtt' | 'json' | 'md',
  ) => {
    if (!videoData || !mainTranscript) return;

    try {
      const result = ExportBuilder.exportTranscript(
        {
          video: videoData as unknown as Video,
          transcript: mainTranscript as unknown as Transcript,
          insights: insights as unknown as AiInsights | null,
          segments: (mainTranscript.transcript_json as any)
            ?.segments as TranscriptSegment[],
        },
        {
          format,
          includeTimestamps: true,
          includeSpeakers: true,
          includeSummary: true,
          includeChapters: true,
        },
      );

      if (Platform.OS === 'web') {
        ExportBuilder.downloadExport(result);
      } else {
        await Clipboard.setStringAsync(result.content);
        Alert.alert('Success', `${format.toUpperCase()} payload copied.`);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Export engine failure.');
    }
  };

  if (isLoading) return <LoadingState />;
  if (error || !videoData)
    return <ErrorState id={id as string} onBack={() => router.replace('/')} />;

  return (
    <SafeAreaView
      style={styles.rootAnchor as ViewStyle}
      className="bg-[#020205]"
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[animatedBgStyle]}
          className="absolute inset-0 rounded-full bg-cyan-500"
        />
        <View className="absolute inset-0 bg-[#020205]/90" />
      </View>

      <View style={styles.fullHeight as ViewStyle}>
        <ScrollView
          style={styles.fullHeight as ViewStyle}
          contentContainerStyle={{
            padding: isMobile ? 20 : 60,
            paddingBottom: 150,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-12">
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/history')
              }
              className="flex-row items-center px-6 py-3 border rounded-full bg-white/[0.03] border-white/10"
            >
              <ArrowLeft size={16} color="#00F0FF" />
              <Text className="ml-3 text-[10px] font-black tracking-[4px] text-blue-400 uppercase">
                RETURN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Share.share({ url: videoData.youtube_url })}
              className="p-3.5 border rounded-full bg-white/[0.03] border-white/10"
            >
              <Share2 size={18} color="#00F0FF" />
            </TouchableOpacity>
          </View>

          {/* Status Banner */}
          <FadeIn>
            <View className="items-center mb-16">
              <View
                className={cn(
                  'px-6 py-1.5 mb-8 border rounded-full',
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-blue-500/10 border-blue-500/20',
                )}
              >
                <Text
                  className={cn(
                    'text-[10px] font-black tracking-[6px] uppercase',
                    isCompleted ? 'text-emerald-400' : 'text-blue-400',
                  )}
                >
                  {videoData.status}
                </Text>
              </View>
              <Text
                className={cn(
                  'font-black text-white tracking-tighter uppercase text-center leading-none',
                  isMobile ? 'text-4xl' : 'text-7xl',
                )}
              >
                Universal <Text className="text-blue-400">Intelligence</Text>
              </Text>
            </View>
          </FadeIn>

          {/* AI Summary */}
          <FadeIn delay={200}>
            <GlassCard
              className="p-10 mb-12 border-white/10"
              glowColor={isAiProcessing ? 'cyan' : 'purple'}
            >
              <View className="flex-row items-center justify-between mb-10">
                <View className="flex-row items-center">
                  <Sparkles size={20} color="#A855F7" />
                  <Text className="text-white/40 text-[11px] font-black uppercase tracking-[5px] ml-5">
                    Executive Abstract
                  </Text>
                </View>
                {isAiProcessing && (
                  <ActivityIndicator size="small" color="#00F0FF" />
                )}
              </View>
              <Text className="text-xl font-medium leading-relaxed text-white/90">
                {insights?.summary ||
                  (isAiProcessing
                    ? 'Decrypting semantic layers...'
                    : 'No summary available.')}
              </Text>
            </GlassCard>
          </FadeIn>

          {/* Takeaways */}
          {takeaways.length > 0 && (
            <FadeIn delay={300}>
              <View className="px-4 mb-16">
                <View className="flex-row items-center mb-10">
                  <Target size={20} color="#00F0FF" />
                  <Text className="text-white/30 text-[11px] font-black uppercase tracking-[5px] ml-5">
                    Strategic Indicators
                  </Text>
                </View>
                <View className="gap-y-5">
                  {takeaways.map((point, i) => (
                    <View key={i} className="flex-row items-start">
                      <View className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_#00F0FF]" />
                      <Text className="flex-1 ml-6 text-base font-medium leading-7 text-white/70">
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeIn>
          )}

          {/* Export Matrix */}
          <FadeIn delay={400}>
            <View className="mb-20">
              <Text className="text-white/20 text-[10px] font-black uppercase tracking-[5px] mb-8 ml-4">
                Export Matrix
              </Text>
              <View className="flex-row flex-wrap gap-4">
                {[
                  { id: 'md', label: 'MARKDOWN', icon: FileText },
                  { id: 'srt', label: 'SUB-RIP', icon: Terminal },
                  { id: 'json', label: 'SCHEMA', icon: Layers },
                  { id: 'txt', label: 'PLAINTEXT', icon: Download },
                ].map((format) => (
                  <TouchableOpacity
                    key={format.id}
                    onPress={() => handleExport(format.id as any)}
                    className="flex-1 min-w-[160px] p-6 border rounded-[30px] bg-white/[0.02] border-white/5"
                  >
                    <format.icon size={16} color="#00F0FF" opacity={0.6} />
                    <Text className="mt-4 text-xs font-black tracking-widest text-white uppercase">
                      {format.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </FadeIn>

          {/* Timeline Matrix */}
          {chapters.length > 0 && (
            <FadeIn delay={500}>
              <View className="mb-20">
                <View className="flex-row items-center mb-10">
                  <Clock size={20} color="#00F0FF" />
                  <Text className="text-white/30 text-[11px] font-black uppercase tracking-[5px] ml-5">
                    Timeline Matrix
                  </Text>
                </View>
                {chapters.map((chapter, i) => (
                  <View
                    key={i}
                    className="flex-row items-start p-8 mb-5 bg-white/[0.02] border border-white/5 rounded-[40px]"
                  >
                    <View className="px-4 py-1.5 border rounded-xl bg-blue-500/10 border-blue-500/30">
                      <Text className="font-mono text-[11px] font-black text-blue-400">
                        {chapter.timestamp}
                      </Text>
                    </View>
                    <View className="flex-1 ml-8">
                      <Text className="mb-3 text-lg font-bold tracking-tight uppercase text-white/90">
                        {chapter.title}
                      </Text>
                      {chapter.description && (
                        <Text className="text-sm italic font-medium leading-7 text-white/40">
                          {chapter.description}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={18} color="#ffffff10" />
                  </View>
                ))}
              </View>
            </FadeIn>
          )}

          {/* Transcript Section */}
          <FadeIn delay={600}>
            <View className="flex-row items-center justify-between px-2 mb-10">
              <View className="flex-row items-center">
                <Zap size={18} color="#3B82F6" />
                <Text className="ml-5 text-white/30 text-[11px] font-black uppercase tracking-[5px]">
                  Transcript Stream
                </Text>
              </View>
            </View>
            <TranscriptViewer
              transcript={mainTranscript as unknown as Transcript}
              chapters={chapters}
            />
          </FadeIn>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootAnchor: {
    flex: 1,
    height:
      Platform.OS === 'web' ? (Dimensions.get('window').height as any) : '100%',
    width: '100%',
  },
  fullHeight: {
    flex: 1,
  },
});

function LoadingState() {
  return (
    <View className="flex-1 bg-[#020205] items-center justify-center">
      <ActivityIndicator size="large" color="#00F0FF" />
      <Text className="mt-10 text-[11px] font-black tracking-[10px] text-blue-400 uppercase">
        SYNCHRONIZING
      </Text>
    </View>
  );
}

function ErrorState({ id, onBack }: { id: string; onBack: () => void }) {
  return (
    <View className="flex-1 bg-[#020205] items-center justify-center p-12">
      <GlassCard
        glowColor="pink"
        className="items-center w-full p-14 border-rose-500/20"
      >
        <AlertCircle size={56} color="#FF0055" />
        <Text className="mt-10 mb-4 text-3xl font-black uppercase text-rose-500">
          UPLINK_TERMINATED
        </Text>
        <Text className="mb-12 text-[10px] tracking-[4px] text-center text-white/30 uppercase">
          Node {id.slice(0, 8)} unreachable.
        </Text>
        <TouchableOpacity
          onPress={onBack}
          className="w-full py-6 border rounded-[25px] border-rose-500/30 bg-rose-500/10"
        >
          <Text className="text-rose-400 text-center text-[11px] font-black uppercase">
            EJECT
          </Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}
