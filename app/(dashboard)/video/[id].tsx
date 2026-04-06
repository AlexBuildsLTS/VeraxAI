/**
 * app/(dashboard)/video/[id].tsx
 * Master Intelligence Dossier - Sovereign Monolithic Layout
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE & USER DIRECTIVES (ENDGAME VERSION):
 * 1. AMBIENT ENGINE: Imported the breathing gradient animation from Dashboard.
 * 2. RESPONSIVE MATRIX: Export buttons use flex-1 with min-width to stack perfectly
 * on mobile (no gluing) and expand seamlessly on desktop.
 * 3. DYNAMIC WIDTH: ScrollView constrained to max-w-7xl (1280px) for optimal
 * desktop readability without stretching too far.
 * 4. STRICT TYPES: `?? undefined` fallbacks guarantee zero Supabase schema crashes.
 * 5. OVERFLOW PROTECTION: Strict flex-shrink and wordBreak CSS applied to transcript.
 * 6. TIMELINE FIX: The purple timeline line extends to `bottom-0`.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Linking,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Sparkles,
  Clock,
  Copy,
  AlertCircle,
  FileText,
  Download,
  Terminal,
  Layers,
  AlignLeft,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  Milestone,
  Zap,
  ArrowBigLeftDash,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  Easing,
  FadeInDown,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

// ─── INTERNAL DEPENDENCIES ───────────────────────────────────────────────────
import { useVideoData } from '../../../hooks/queries/useVideoData';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ExportBuilder } from '../../../services/exportBuilder';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';
import type {
  Video,
  Transcript,
  AiInsights,
  Chapter,
} from '../../../types/api';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT BACKGROUND ENGINE (Breathing Animation)
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// 1. AMBIENT BACKGROUND ENGINE (100% Exact Match to Dashboard index.tsx)
// ══════════════════════════════════════════════════════════════════════════════
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
        },
      ]}
    />
  );
};

const AmbientEngine = React.memo(() => (
  <View
    className="absolute inset-0 overflow-hidden bg-[#01111fbe]"
    style={{ pointerEvents: 'none', zIndex: 0 }}
  >
    <AmbientGradient delay={0.5} color="#3B82F6" />
    <AmbientGradient delay={3000} color="#8B5CF6" />
  </View>
));
// ══════════════════════════════════════════════════════════════════════════════
// 2. EXPORT MATRIX COMPONENT (Top Level)
// ══════════════════════════════════════════════════════════════════════════════
const ExportControlMatrix = React.memo(
  ({
    onExport,
    isMobile,
  }: {
    onExport: (format: any) => void;
    isMobile: boolean;
  }) => {
    const formats = [
      { id: 'md', label: 'MARKDOWN', icon: FileText, color: '#FCD34D' },
      { id: 'srt', label: 'SUB-RIP (SRT)', icon: Terminal, color: '#F472B6' },
      { id: 'json', label: 'RAW SCHEMA', icon: Layers, color: '#A855F7' },
      { id: 'txt', label: 'PLAINTEXT', icon: AlignLeft, color: '#60A5FA' },
    ];

    return (
      <Animated.View
        entering={FadeInDown.duration(600).springify()}
        className="w-full mb-12"
      >
        <View className="flex-row flex-wrap w-full gap-3 px-2 md:gap-4 md:px-0">
          {formats.map((format) => (
            <TouchableOpacity
              key={format.id}
              onPress={() => onExport(format.id)}
              activeOpacity={0.7}
              style={{ width: isMobile ? '40%' : 'auto' }}
              className="md:flex-1 p-4 md:p-6 border rounded-2xl md:rounded-3xl bg-[#05050A]/90 border-white/5 hover:bg-white/[0.04] transition-all group flex-row items-center justify-between shadow-xl mb-4"
            >
              <View className="flex-row items-center flex-1">
                <format.icon
                  size={isMobile ? 16 : 18}
                  color={format.color}
                  strokeWidth={2.5}
                  opacity={0.8}
                  className="mr-2 md:mr-4"
                />
                <Text className="text-[9px] md:text-xs font-black tracking-widest uppercase text-white/70 group-hover:text-white transition-colors flex-shrink">
                  {format.label}
                </Text>
              </View>
              <Download
                size={14}
                color="#ffffff20"
                className="ml-2 transition-colors group-hover:text-white/60"
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE UNIFIED MEGA-BOX COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
interface MegaBoxProps {
  title?: string;
  youtubeUrl?: string;
  summary?: string;
  transcriptText?: string;
  chapters: Chapter[];
  takeaways: string[];
  isProcessing: boolean;
  extractionMethod?: string;
  wordCount?: number;
  readingTime?: number;
}

const UnifiedMegaBox = React.memo(
  ({
    title,
    youtubeUrl,
    summary,
    transcriptText,
    chapters,
    takeaways,
    isProcessing,
    extractionMethod,
    wordCount,
    readingTime,
  }: MegaBoxProps) => {
    const [copySuccess, setCopySuccess] = React.useState(false);

    const handleCopyAll = async () => {
      const payload = `TITLE: ${title}\n\nEXECUTIVE ABSTRACT:\n${summary || 'N/A'}\n\nVERBATIM TRANSCRIPT:\n${transcriptText || 'N/A'}`;
      await Clipboard.setStringAsync(payload);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(700).springify()}
        className="mb-16"
      >
        <GlassCard
          glowColor="cyan"
          className="p-0 bg-[#07070E]/95 border-white/5 rounded-[48px] overflow-hidden shadow-2xl"
        >
          {/* ── PART A: HERO & TITLE (Inside the Box) ── */}
          <View className="px-8 pt-12 pb-8 border-b md:px-14 bg-white/[0.01] border-white/5 relative overflow-hidden">
            <View
              className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]"
              pointerEvents="none"
            />

            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-row items-center px-4 py-2 border rounded-xl bg-cyan-500/10 border-cyan-500/30">
                <BookOpen size={14} color="#00F0FF" />
                <Text className="ml-3 text-[10px] font-black text-cyan-400 uppercase tracking-[4px]">
                  Video Report
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyAll}
                className="flex-row items-center p-3 transition-colors border bg-white/5 rounded-xl hover:bg-white/10 active:scale-95 border-white/5"
              >
                {copySuccess ? (
                  <CheckCircle2 size={16} color="#34D399" />
                ) : (
                  <Copy size={16} color="#00F0FF" opacity={0.8} />
                )}
                <Text className="ml-3 text-[10px] font-black uppercase text-white/50 tracking-widest hidden md:flex">
                  Copy All
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-6 text-4xl font-black leading-tight tracking-tighter text-white md:text-5xl lg:text-6xl">
              {title || 'Untitled Video'}
            </Text>

            <View className="flex-row flex-wrap items-center gap-6 md:gap-10 opacity-80">
              <View className="flex-row items-center">
                <Clock size={16} color="#00F0FF" />
                <Text className="ml-3 font-mono text-xs tracking-widest text-white uppercase">
                  {readingTime || 0} Min Read
                </Text>
              </View>
              <View className="flex-row items-center">
                <AlignLeft size={16} color="#00F0FF" />
                <Text className="ml-3 font-mono text-xs tracking-widest text-white uppercase">
                  {wordCount?.toLocaleString() || 0} Words
                </Text>
              </View>
              {youtubeUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(youtubeUrl)}
                  className="flex-row items-center transition-opacity hover:opacity-70"
                >
                  <ExternalLink size={16} color="#C084FC" />
                  <Text className="ml-3 text-purple-400 font-black text-[10px] uppercase tracking-widest">
                    View Source
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── LOADING STATE ── */}
          {isProcessing ? (
            <View className="items-center justify-center py-32">
              <ActivityIndicator size="large" color="#00F0FF" />
              <Text className="mt-8 text-cyan-400/60 font-mono text-xs uppercase tracking-[5px] text-center leading-loose">
                Decrypting Neural Matrix...{'\n'}Synthesizing Abstract &
                Verbatim Data.
              </Text>
            </View>
          ) : (
            <View className="px-8 py-12 md:px-14">
              {/* ── PART B: EXECUTIVE ABSTRACT ── */}
              <View className="mb-16">
                <View className="flex-row items-center mb-8">
                  <Sparkles size={20} color="#C084FC" />
                  <Text className="text-purple-400 font-black text-[11px] md:text-xs uppercase tracking-[5px] ml-4">
                    Summary
                  </Text>
                </View>
                <Text className="text-white/90 leading-[32px] md:leading-[38px] text-base md:text-lg font-medium text-justify mb-12">
                  {summary || (
                    <Text className="italic opacity-50">
                      Summary pending or unavailable.
                    </Text>
                  )}
                </Text>

                {/* ── PART C: KEY TAKEAWAYS ── */}
                {takeaways.length > 0 && (
                  <View className="p-8 border bg-black/20 border-white/5 rounded-[32px]">
                    <Text className="text-white/40 font-black text-[10px] uppercase tracking-[4px] mb-6">
                      Key Takeaways
                    </Text>
                    <View className="gap-y-4">
                      {takeaways.map((point, idx) => (
                        <View key={idx} className="flex-row items-start">
                          <View className="items-center justify-center w-6 h-6 mt-1 mr-4 border rounded-full bg-purple-500/10 border-purple-500/30">
                            <Text className="text-[9px] font-black text-purple-400">
                              {idx + 1}
                            </Text>
                          </View>
                          <Text className="flex-1 text-base font-medium leading-8 text-white/70">
                            {point}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View className="w-full h-px mb-16 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* ── PART D: SIDE-BY-SIDE TIMELINE AND RAW TEXT ── */}
              {/* Using standard flex-col to flex-row for responsive layout */}
              <View className="flex-col gap-12 lg:flex-row lg:gap-16">
                {/* ── LEFT COLUMN: TIMELINE MAPPING ── */}
                {chapters.length > 0 && (
                  <View className="w-full lg:w-1/3">
                    <View className="flex-row items-center mb-10">
                      <Milestone size={20} color="#C084FC" />
                      <Text className="text-white/50 text-[11px] font-black uppercase tracking-[4px] ml-4">
                        Chapters
                      </Text>
                    </View>

                    <View className="relative pl-2 md:pl-4">
                      {/* Continuous Vertical Line */}
                     <View className="absolute left-[39px] md:left-[43px] top-4 bottom-0 w-[2px] bg-purple-500/20 rounded-full" />

                      {chapters.map((chapter, idx) => (
                        <View
                          key={idx}
                          className="relative flex-row items-start mb-10 group"
                        >
                          {/* Glowing Node Dot */}
                          <View className="absolute left-[34px] md:left-[38px] top-[14px] w-[12px] h-[12px] rounded-full bg-[#07070E] border-[2px] border-purple-500 shadow-[0_0_15px_#C084FC] z-10 transition-transform group-hover:scale-125 group-hover:bg-purple-400" />

                          {/* Timestamp Label */}
                          <View className="items-end w-12 pt-1 pr-6 md:w-14">
                            <Text className="text-[10px] font-bold font-mono text-purple-400/80 group-hover:text-purple-400 transition-colors">
                              {chapter.timestamp}
                            </Text>
                          </View>

                          {/* Chapter Text */}
                          <View className="flex-1 pl-4">
                            <Text className="mb-2 text-base font-black tracking-tight text-white/90">
                              {chapter.title}
                            </Text>
                            {chapter.description && (
                              <Text className="text-sm font-medium leading-relaxed transition-colors text-white/50 group-hover:text-white/80">
                                {chapter.description}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── RIGHT COLUMN: RAW VERBATIM TRANSCRIPT ── */}
                <View
                  className={cn(
                    'w-full',
                    chapters.length > 0 ? 'lg:flex-1' : 'lg:w-full',  
                  )}
                >
                  <View className="flex-row items-center mb-10">
                    <Zap size={20} color="#34D399" />
                    <Text className="text-white/50 text-[11px] font-black uppercase tracking-[4px] ml-4">
                      Transcript
                    </Text>
                  </View>

                  {transcriptText ? (
                    <View className="p-8 md:p-12 border bg-black/20 border-white/10 rounded-[32px] relative overflow-hidden w-full"> 
                      {/* Ambient Glow */}
                      <View                      
                        className="absolute top-0 right-20 w-full h-40 bg-emerald-500/5 blur-[80px]"
                        pointerEvents="none"
                      />

                 {/* The Full Text Box */}
                      <View className="w-full">
                        <Text
                          className="text-base font-medium tracking-wide md:text-lg text-white/90"
                          style={{ 
                            textAlign: 'left',
                            lineHeight: Platform.OS === 'web' ? 38 : 38,
                            flexShrink: 2,
                            ...(Platform.OS === 'web' ? { wordBreak: 'break-word', whiteSpace: 'pre-wrap' } as any : {})
                          }}
                        >
                          {transcriptText}
                        </Text>
                      </View>

                      {/* Metadata Footer for the text */}
                      <View className="flex-row items-center justify-between pt-8 mt-12 border-t border-white/10">
                        <View>
                          <Text className="text-white/30 text-[9px] font-black uppercase tracking-[3px]">
                            Extraction Method
                          </Text>
                          <Text className="mt-1.5 font-mono text-[10px] uppercase text-emerald-400/60">
                            {extractionMethod || 'SYSTEM_DEFAULT'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="items-center justify-center p-16 border border-white/5 rounded-[32px] bg-black/20">
                      <Terminal size={28} color="#ffffff20" />
                      <Text className="mt-6 font-mono text-xs text-white/30 uppercase tracking-[4px]">
                        Transcript not available
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </GlassCard>
      </Animated.View>
    );
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. CONCLUDING SYNTHESIS BOX
// ══════════════════════════════════════════════════════════════════════════════
const ConcludingSynthesis = React.memo(
  ({ conclusion }: { conclusion?: string }) => (
    <Animated.View
      entering={FadeInDown.duration(900).springify()}
      className="mb-20"
    >
      <GlassCard
        glowColor="lime"
        className="p-8 md:p-12 bg-emerald-500/[0.02] border-emerald-500/10 rounded-[40px]"
      >
        <View className="flex-row items-center justify-center mb-6">
          <ShieldCheck size={28} color="#34D399" />
        </View>
        <Text className="text-emerald-400 font-black text-xs md:text-sm uppercase tracking-[6px] text-center mb-6">
          Concluding Synthesis
        </Text>
        <Text className="px-4 text-base font-medium leading-relaxed text-center text-white/70 md:text-lg md:px-10">
          {conclusion ||
            'Analysis complete. All intelligence has been extracted and preserved.'}
        </Text>
      </GlassCard>
    </Animated.View>
  ),
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. MASTER PAGE CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════
export default function MasterIntelligenceView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 768;

  // ─── QUERY ENGINE ───
  const { data: videoRecord, isLoading, error } = useVideoData(id);
  const scrollY = useSharedValue(0);

  // ─── DATA DESTRUCTURING & STRICT TYPE SAFETY (null handled) ───
  const insights = videoRecord?.ai_insights;
  const transcript = videoRecord?.transcripts?.[0];

  const chapters = useMemo<Chapter[]>(() => {
    if (!insights?.chapters) return [];
    return Array.isArray(insights.chapters)
      ? (insights.chapters as unknown as Chapter[])
      : [];
  }, [insights]);

  const takeaways = useMemo<string[]>(() => {
    if (!insights?.key_takeaways) return [];
    return Array.isArray(insights.key_takeaways)
      ? (insights.key_takeaways as string[])
      : [];
  }, [insights]);

  const seoMetadata = useMemo(() => {
    if (!insights?.seo_metadata)
      return { suggested_titles: [], description: '', tags: [] };
    const raw = insights.seo_metadata as Record<string, any>;
    return {
      suggested_titles: Array.isArray(raw.suggested_titles)
        ? raw.suggested_titles
        : [],
      description: typeof raw.description === 'string' ? raw.description : '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    };
  }, [insights]);

  const displayTitle =
    seoMetadata.suggested_titles[0] ||
    videoRecord?.title ||
    'Decrypted Media Payload';
  const isProcessing =
    videoRecord?.status === 'transcribing' ||
    videoRecord?.status === 'ai_processing' ||
    videoRecord?.status === 'queued';
  const isCompleted = videoRecord?.status === 'completed';

  // ─── EXPORT DISPATCHER ───
  const handleExport = useCallback(
    async (format: 'txt' | 'srt' | 'json' | 'md') => {
      if (!videoRecord || !transcript) return;
      const exportPayload = {
        video: videoRecord as unknown as Video,
        transcript: transcript as unknown as Transcript,
        insights: insights as unknown as AiInsights,
      };
      const options = {
        format,
        includeTimestamps: true,
        includeSpeakers: true,
        includeSummary: true,
        includeChapters: true,
      };

      try {
        const result = ExportBuilder.exportTranscript(exportPayload, options);
        if (Platform.OS === 'web') {
          ExportBuilder.downloadExport(result);
        } else {
          await Clipboard.setStringAsync(result.content);
          alert(
            `Exported ${format.toUpperCase()} payload copied to clipboard.`,
          );
        }
      } catch (err) {
        console.error('[Export Failure]', err);
      }
    },
    [videoRecord, transcript, insights],
  );

  // ─── ANIMATED STYLES ───
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: 'transparent', 
    borderBottomWidth: 0,
    zIndex: 1000,
  }));

  // ─── FATAL ERROR STATE ───
  if (error || (!isLoading && !videoRecord)) {
    return (
      <View className="flex-1 bg-[#020205] items-center justify-center p-6 md:p-12 z-50">
        <AmbientEngine />
        <GlassCard
          glowColor="pink"
          className="items-center w-full max-w-lg p-10 md:p-16 border-rose-500/20 bg-[#0a0a14]/90 z-50"
        >
          <AlertCircle size={48} color="#F43F5E" className="mb-8" />
          <Text className="mb-4 text-2xl font-black tracking-widest text-center uppercase text-rose-500">
            Node Unreachable
          </Text>
          <Text className="mb-12 text-sm leading-relaxed text-center text-white/40">
            The requested intelligence payload could not be located.
          </Text>
         <TouchableOpacity
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/history' as any)
          }
          className="flex-row items-center mb-10 gap-x-2"
          activeOpacity={0.7}
        >
          <ArrowBigLeftDash size={18} color="#00F0FF" />
          <Text className="text-[10px] font-black tracking-[4px] text-neon-cyan uppercase">
            Return
          </Text>
        </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  // ─── MAIN RENDER PIPELINE ───
  return (
    <View className="flex-1 bg-[#020205]">
      <StatusBar barStyle="light-content" />
      <AmbientEngine />

      {/* STICKY HEADER */}
      <Animated.View
        style={[
          headerStyle,
          {
            paddingTop: insets.top,
            zIndex: 100,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-4 py-4 md:px-8">
             <TouchableOpacity
                   onPress={() =>
                     router.canGoBack()
                       ? router.back()
                       : router.replace('/history' as any)
                   }
                   className="flex-row items-center mb-10 gap-x-2"
                   activeOpacity={0.7}
                 >
                   <ArrowBigLeftDash size={18} color="#00F0FF" />
                   <Text className="text-[10px] font-black tracking-[4px] text-neon-cyan uppercase">
                     Return
                   </Text>
                 </TouchableOpacity>
          <View className="flex-row items-center gap-4">
            <View
              className={cn(
                'px-4 py-1.5 rounded-full border flex-row items-center shadow-lg',
                isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-blue-500/10 border-blue-500/30',
              )}
            >
              {isProcessing && (
                <ActivityIndicator
                  size="small"
                  color="#60A5FA"
                  className="mr-2"
                />
              )}
              {isCompleted && (
                <CheckCircle2 size={12} color="#34D399" className="mr-2" />
              )}
              <Text
                className={cn(
                  'text-[9px] font-black uppercase tracking-[3px]',
                  isCompleted ? 'text-emerald-400' : 'text-blue-400',
                )}
              >
                {videoRecord?.status
                  ? videoRecord.status.replace('_', ' ')
                  : 'SYNCING'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* CONTINUOUS DOSSIER SCROLL */}
      <Animated.ScrollView
        className="z-10 flex-1"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 100,
          paddingBottom: 150,
          paddingHorizontal: isMobile ? 12 : 32,
          maxWidth: 1400,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. EXPORT MATRIX (Top Level) */}
        {!isProcessing && isCompleted && (
          <ExportControlMatrix onExport={handleExport} isMobile={isMobile} />
        )}

        {/* 2. THE UNIFIED MEGA-BOX */}
        <UnifiedMegaBox
          title={displayTitle ?? undefined}
          youtubeUrl={videoRecord?.youtube_url ?? undefined}
          summary={insights?.summary ?? undefined}
          transcriptText={transcript?.transcript_text ?? undefined}
          chapters={chapters}
          takeaways={takeaways}
          isProcessing={isProcessing}
          extractionMethod={transcript?.extraction_method ?? undefined}
          wordCount={transcript?.word_count ?? undefined}
          readingTime={transcript?.reading_time_minutes ?? undefined}
        />

        {/* 3. CONCLUDING SYNTHESIS BOX */}
        {!isProcessing && isCompleted && (
          <ConcludingSynthesis
            conclusion={(insights?.conclusion as string | null) ?? undefined}
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}
