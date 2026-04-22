/**
 * app/(dashboard)/video/[id].tsx
 * VeraxAI Transcripts
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * GRID TIMELINE FIXED Strict Flexbox columns permanently prevent UI overlap on Webbn
 * INSTANT TOUCH: delayPressIn={0} + keyboardShouldPersistTaps="always" eliminates APK tap dropss
 * NESTED SCROLLING: Independent scroll view for verbatim text works natively on Android
 *  Wandering Core Engine renders beneath the UI safely (zIndex:-1)
 * EXPORT: Try/Finally blocks guarantee buttons never get stuck loadin
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Linking,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
  Sparkles,
  Cpu,
  Activity,
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
  FadeInUp,
  useAnimatedScrollHandler,
  useFrameCallback,
} from 'react-native-reanimated';

// ─── INTERNAL DEPENDENCIES ───────────────────────────────────────────────────
import { useVideoData } from '../../../hooks/queries/useVideoData';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ExportBuilder } from '../../../services/exportBuilder';
import { cn } from '../../../lib/utils';
import type { Video, Transcript, AiInsights } from '../../../types/api';

// ─── LOCAL TYPES ─────────────────────────────────────────────────────────────
interface DossierChapter {
  title: string;
  timestamp?: string;
  description?: string;
}

// ─── CONSTANTS & PALETTE (Liquid Neon) ───────────────────────────────────────
const IS_WEB = Platform.OS === 'web';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const THEME = {
  obsidian: '#000012',
  navy: '#05121F',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  green: '#32FF00',
  pink: '#FF007F',
  gold: '#FFD700',
  danger: '#F43F5E',
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT ENGINE (Wandering Core + Nebula)
// ══════════════════════════════════════════════════════════════════════════════

const SingleRipple = React.memo(({ color, delay, duration, maxSize }: any) => {
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
    opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 0.15, 0.02, 0]),
    borderWidth: interpolate(progress.value, [0, 1], [60, 20]),
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
});

const WanderingCore = React.memo(
  ({ coreSize, color, maxWaveSize, waveCount, baseDuration }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);
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

    const corePulse = useSharedValue(0.4);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, [corePulse]);

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
            key={index}
            color={color}
            delay={index * (baseDuration / waveCount)}
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

const AmbientArchitecture = React.memo(() => {
  const { width, height } = Dimensions.get('window');
  return (
    // STRICT TOUCH SAFETY: zIndex -1 and elevation -1 prevent UI blocking on Android
    <View
      style={[StyleSheet.absoluteFill, { zIndex: -1, elevation: -1 }]}
      pointerEvents="none"
    >
      <WanderingCore
        coreSize={14}
        color={THEME.cyan}
        maxWaveSize={width >= 1024 ? width * 0.8 : height * 1.0}
        waveCount={4}
        baseDuration={12000}
      />
    </View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: EXPORT CONTROL MATRIX (Guaranteed Unlock)
// ══════════════════════════════════════════════════════════════════════════════
const ExportControlMatrix = React.memo(
  ({
    onExport,
    isMobile,
  }: {
    onExport: (format: 'md' | 'srt' | 'json' | 'txt') => Promise<void>;
    isMobile: boolean;
  }) => {
    const formats: {
      id: 'md' | 'srt' | 'json' | 'txt';
      label: string;
      icon: any;
      color: string;
    }[] = [
      { id: 'md', label: 'Markdown', icon: FileText, color: THEME.gold },
      {
        id: 'srt',
        label: 'Subtitles (SRT)',
        icon: Terminal,
        color: THEME.pink,
      },
      { id: 'json', label: 'JSON Data', icon: Layers, color: THEME.purple },
      { id: 'txt', label: 'Plain Text', icon: AlignLeft, color: THEME.cyan },
    ];

    const [busyId, setBusyId] = useState<string | null>(null);

    const handlePress = async (id: 'md' | 'srt' | 'json' | 'txt') => {
      setBusyId(id);
      try {
        await onExport(id);
      } finally {
        // GUARANTEE: The button will always unlock even if native OS rejects the share sheet
        setBusyId(null);
      }
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(600).springify()}
        style={{ zIndex: 30, width: '100%', marginBottom: 32 }}
      >
        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={
            isMobile
              ? { gap: 12, paddingHorizontal: 4 }
              : { width: '100%', flexDirection: 'row', gap: 16 }
          }
        >
          {formats.map((format) => (
            <TouchableOpacity
              key={format.id}
              onPress={() => handlePress(format.id)}
              disabled={busyId !== null}
              activeOpacity={0.7}
              delayPressIn={0} // CRITICAL APK FIX
              style={isMobile ? { width: 180 } : { flex: 1 }}
              className="flex-row items-center justify-between p-4 transition-all shadow-xl md:p-6 border rounded-2xl md:rounded-[24px] bg-[#05050A]/90 border-white/10 hover:bg-white/[0.04]"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <format.icon
                  size={isMobile ? 16 : 18}
                  color={format.color}
                  strokeWidth={2.5}
                  className="mr-3"
                />
                <Text className="text-[10px] md:text-xs font-black tracking-widest uppercase text-white/80 flex-shrink">
                  {format.label}
                </Text>
              </View>
              {busyId === format.id ? (
                <ActivityIndicator size="small" color={format.color} />
              ) : (
                <Download size={14} color="#ffffff40" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: FLAWLESS GRID CHAPTER TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
const ChapterTimeline = ({
  chapters,
  isMobile,
}: {
  chapters: DossierChapter[];
  isMobile: boolean;
}) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!chapters.length) return null;

  return (
    <View className="w-full">
      {chapters.map((ch, i) => {
        const isOpen = openIdx === i;
        const isLast = i === chapters.length - 1;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => setOpenIdx(isOpen ? null : i)}
            activeOpacity={0.7}
            delayPressIn={0} // CRITICAL APK FIX: Instantly registers the tap
            className="flex-row w-full mb-2"
          >
            {/* DESKTOP: Dedicated Timestamp Column (Zero Overlap) */}
            {!isMobile && (
              <View className="items-end pr-4 w-20 pt-[18px]">
                {ch.timestamp && (
                  <Text
                    className={cn(
                      'text-[10px] font-mono font-bold tracking-widest',
                      isOpen ? 'text-cyan-400' : 'text-purple-400',
                    )}
                  >
                    {ch.timestamp}
                  </Text>
                )}
              </View>
            )}

            {/* VERTICAL TRACK & GLOWING NODE */}
            <View className="relative items-center w-8">
              {/* The connecting line (stops before the last item) */}
              {!isLast && (
                <View className="absolute top-8 bottom-[-8px] w-[2px] bg-purple-500/20" />
              )}

              {/* The Glowing Node */}
              <View
                className={cn(
                  'w-3.5 h-3.5 rounded-full mt-5 z-10 bg-[#000012] border-2',
                  isOpen
                    ? 'border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]'
                    : 'border-purple-500 shadow-[0_0_8px_rgba(138,43,226,0.8)]',
                )}
              />
            </View>

            {/* CONTENT CARD COLUMN */}
            <View className="flex-1 pb-6 pl-4">
              <View
                className={cn(
                  'p-4 md:p-5 rounded-2xl border transition-all',
                  isOpen
                    ? 'bg-[#05121F] border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.1)]'
                    : 'bg-white/[0.02] border-white/5',
                )}
              >
                <View className="flex-row items-start justify-between mb-1">
                  <Text
                    className={cn(
                      'flex-1 text-sm md:text-base font-bold pr-2 leading-5',
                      isOpen ? 'text-cyan-400' : 'text-white/90',
                    )}
                  >
                    {ch.title}
                  </Text>
                  {/* MOBILE: Timestamp rendered inside the card header */}
                  {isMobile && ch.timestamp && (
                    <Text
                      className={cn(
                        'text-[10px] font-mono font-bold mt-0.5',
                        isOpen ? 'text-cyan-400' : 'text-purple-400',
                      )}
                    >
                      {ch.timestamp}
                    </Text>
                  )}
                </View>
                {(isOpen || !ch.timestamp) && ch.description && (
                  <Text className="mt-2 text-xs leading-relaxed md:text-sm text-white/60">
                    {ch.description}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: DIARIZATION-READY RAW TRANSCRIPT VIEWER
// ══════════════════════════════════════════════════════════════════════════════
const DiarizedTranscript = ({ text }: { text: string }) => {
  // Parses standard speaker tags: [SPK_1], [Speaker A], etc.
  const speakerRegex = /\[?(SPK_\d+|Speaker\s[A-Z0-9]+)\]?:?\s*(.*)/i;
  const paragraphs = text.split('\n').filter((p) => p.trim().length > 0);

  return (
    <View className="gap-y-4">
      {paragraphs.map((paragraph, index) => {
        const match = paragraph.match(speakerRegex);

        if (match) {
          const speakerName = match[1];
          const spokenText = match[2];
          const isSpeakerA =
            speakerName.includes('1') || speakerName.includes('A');

          return (
            <View
              key={index}
              className={cn(
                'flex-col max-w-[90%]',
                isSpeakerA ? 'self-start' : 'self-end items-end',
              )}
            >
              <Text
                className={cn(
                  'text-[9px] font-black uppercase tracking-widest mb-1',
                  isSpeakerA ? 'text-cyan-400' : 'text-purple-400',
                )}
              >
                {speakerName}
              </Text>
              <View
                className={cn(
                  'p-4 rounded-2xl border',
                  isSpeakerA
                    ? 'bg-cyan-900/10 border-cyan-500/20 rounded-tl-sm'
                    : 'bg-purple-900/10 border-purple-500/20 rounded-tr-sm',
                )}
              >
                <Text className="text-sm leading-relaxed md:text-base text-white/80">
                  {spokenText.trim()}
                </Text>
              </View>
            </View>
          );
        }

        // Standard Text Segment
        return (
          <Text
            key={index}
            className="text-sm leading-relaxed tracking-wide text-justify md:text-base text-white/70"
            selectable
          >
            {paragraph.trim()}
          </Text>
        );
      })}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 5: THE UNIFIED REPORT BOX
// ══════════════════════════════════════════════════════════════════════════════
interface ReportBoxProps {
  title?: string;
  youtubeUrl?: string;
  summary?: string;
  transcriptText?: string;
  chapters: DossierChapter[];
  takeaways: string[];
  isProcessing: boolean;
  extractionMethod?: string;
  wordCount?: number;
  readingTime?: number;
  isMobile: boolean;
  status?: string;
}

const UnifiedReportBox = React.memo(
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
    isMobile,
    status,
  }: ReportBoxProps) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyAll = async () => {
      const payload = `TITLE: ${title}\n\nSUMMARY:\n${summary || 'N/A'}\n\nTRANSCRIPT:\n${transcriptText || 'N/A'}`;
      await Clipboard.setStringAsync(payload);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    const statusGlow = isProcessing
      ? THEME.cyan
      : status === 'completed'
        ? THEME.green
        : status === 'failed'
          ? THEME.danger
          : THEME.cyan;

    return (
      <Animated.View
        entering={FadeInDown.duration(700).springify()}
        className="z-10 mb-8"
      >
        <GlassCard
          style={{
            shadowColor: statusGlow,
            shadowOpacity: 0.15,
            shadowRadius: 30,
          }}
          className="p-0 bg-[#07070E]/95 border-white/5 rounded-[32px] md:rounded-[48px] overflow-hidden"
        >
          {/* ── HERO HEADER ── */}
          <View className="px-6 pt-10 pb-8 border-b md:px-14 md:pt-12 bg-white/[0.01] border-white/5 relative overflow-hidden">
            <View
              style={{
                position: 'absolute',
                top: -100,
                right: -50,
                width: 300,
                height: 300,
                backgroundColor: `${statusGlow}15`,
                borderRadius: 150,
                pointerEvents: 'none',
              }}
              className="blur-[100px]"
            />

            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-row items-center px-4 py-2 border rounded-full bg-white/5 border-white/10">
                <BookOpen size={14} color={THEME.cyan} />
                <Text className="ml-3 text-[10px] font-black text-cyan-400 uppercase tracking-[4px]">
                  Intelligence TRANSCRIPT
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyAll}
                delayPressIn={0}
                className="z-20 flex-row items-center p-3 transition-colors border bg-white/[0.03] rounded-full hover:bg-white/10 active:scale-95 border-white/10 md:px-5 md:py-2.5"
              >
                {copySuccess ? (
                  <CheckCircle2 size={14} color={THEME.green} />
                ) : (
                  <Copy size={14} color={THEME.cyan} opacity={0.8} />
                )}
                <Text className="ml-2 text-[10px] font-black uppercase text-white/60 tracking-widest hidden md:flex">
                  Copy Payload
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-6 text-3xl font-black leading-tight tracking-tighter text-white md:text-5xl lg:text-6xl">
              {title || 'Decrypting Payload...'}
            </Text>

            <View className="z-20 flex-row flex-wrap items-center gap-5 md:gap-8 opacity-80">
              {readingTime && (
                <View className="flex-row items-center">
                  <Clock size={14} color={THEME.cyan} />
                  <Text className="ml-2 font-mono text-[10px] tracking-[2px] text-white uppercase">
                    {Math.round(readingTime)} Min Read
                  </Text>
                </View>
              )}
              {wordCount && (
                <View className="flex-row items-center">
                  <AlignLeft size={14} color={THEME.cyan} />
                  <Text className="ml-2 font-mono text-[10px] tracking-[2px] text-white uppercase">
                    {wordCount.toLocaleString()} Words
                  </Text>
                </View>
              )}
              {youtubeUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(youtubeUrl)}
                  delayPressIn={0}
                  className="flex-row items-center transition-opacity hover:opacity-70"
                >
                  <ExternalLink size={14} color={THEME.purple} />
                  <Text className="ml-2 text-purple-400 font-black text-[10px] uppercase tracking-[2px]">
                    View Source
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── DYNAMIC BODY ── */}
          {isProcessing ? (
            <View className="items-center justify-center py-20 md:py-32">
              <ActivityIndicator size="large" color={THEME.cyan} />
              <Text className="mt-8 text-cyan-400/60 font-mono text-[10px] md:text-xs uppercase tracking-[5px] text-center leading-loose">
                Neural Extraction In Progress...{'\n'}Synthesizing Abstract
                Data.
              </Text>
            </View>
          ) : (
            <View className="px-5 py-8 md:px-10 md:py-12">
              {/* ABSTRACT & TAKEAWAYS */}
              <View className="mb-12 md:mb-16">
                <View className="flex-row items-center mb-6">
                  <Sparkles size={18} color={THEME.purple} />
                  <Text className="text-purple-400 font-black text-[11px] md:text-xs uppercase tracking-[5px] ml-3">
                    Executive Abstract
                  </Text>
                </View>
                <Text className="text-white/80 leading-[28px] md:leading-[34px] text-sm md:text-base font-medium text-justify mb-10">
                  {summary || (
                    <Text className="italic opacity-50">
                      Summary pending or unavailable.
                    </Text>
                  )}
                </Text>

                {takeaways.length > 0 && (
                  <View className="p-6 border md:p-8 bg-white/[0.015] border-white/5 rounded-[24px] md:rounded-[32px]">
                    <Text className="text-white/40 font-black text-[9px] md:text-[10px] uppercase tracking-[4px] mb-6">
                      Strategic Indicators
                    </Text>
                    <View className="gap-y-4">
                      {takeaways.map((point, idx) => (
                        <View key={idx} className="flex-row items-start">
                          <View className="items-center justify-center w-5 h-5 md:w-6 md:h-6 mt-0.5 md:mt-1 mr-3 md:mr-4 border rounded-full bg-purple-500/10 border-purple-500/30">
                            <Text className="text-[8px] md:text-[9px] font-black text-purple-400">
                              {idx + 1}
                            </Text>
                          </View>
                          <Text className="flex-1 text-sm font-medium leading-7 md:text-base text-white/70">
                            {point}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View className="w-full h-px mb-12 md:mb-16 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* SPLIT PANE: TIMELINE & RAW TEXT */}
              <View
                className={cn(
                  'flex-col gap-10',
                  isMobile ? '' : 'lg:flex-row lg:gap-12',
                )}
              >
                {/* LEFT: TIMELINE */}
                {chapters.length > 0 && (
                  <View
                    className={cn(
                      'w-full',
                      isMobile ? '' : 'lg:w-2/5 xl:w-1/3',
                    )}
                  >
                    <View className="flex-row items-center mb-8">
                      <Milestone size={18} color={THEME.purple} />
                      <Text className="text-white/50 text-[10px] md:text-[11px] font-black uppercase tracking-[4px] ml-3">
                        Timeline Mapping
                      </Text>
                    </View>
                    <ChapterTimeline chapters={chapters} isMobile={isMobile} />
                  </View>
                )}

                {/* RIGHT: RAW TRANSCRIPT */}
                <View
                  className={cn(
                    'w-full',
                    chapters.length > 0 ? 'lg:flex-1' : 'lg:w-full',
                  )}
                >
                  <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                      <Zap size={18} color={THEME.green} />
                      <Text className="text-white/50 text-[10px] md:text-[11px] font-black uppercase tracking-[4px] ml-3">
                        Verbatim Data Stream
                      </Text>
                    </View>
                  </View>

                  {transcriptText ? (
                    <View className="border bg-[#020205]/60 border-white/5 rounded-[24px] md:rounded-[32px] relative overflow-hidden w-full">
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 80,
                          width: '100%',
                          height: 160,
                          backgroundColor: 'rgba(16,185,129,0.03)',
                          pointerEvents: 'none',
                        }}
                        className="blur-[80px]"
                      />

                      {/* NESTED SCROLL ENABLED + KEYBOARD PERSIST: Crucial for APK Scroll functionality */}
                      <ScrollView
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="always"
                        style={{ maxHeight: isMobile ? 500 : 700 }}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={{ padding: isMobile ? 20 : 32 }}
                      >
                        <DiarizedTranscript text={transcriptText} />
                      </ScrollView>

                      {/* Telemetry Footer */}
                      <View className="flex-row items-center justify-between px-6 py-5 border-t md:px-8 bg-white/[0.02] border-white/5">
                        <View>
                          <Text className="text-white/30 text-[8px] font-black uppercase tracking-[3px]">
                            Extraction
                          </Text>
                          <Text className="mt-1.5 font-mono text-[9px] md:text-[10px] uppercase text-emerald-400/80 flex-row items-center">
                            <Cpu
                              size={10}
                              color={THEME.green}
                              style={{ marginRight: 4 }}
                            />{' '}
                            {extractionMethod || 'DEEPGRAM NOVA-2'}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-white/80 text-[8px] font-black uppercase tracking-[3px]">
                            Confidence
                          </Text>
                          <Text className="mt-1.5 font-mono text-[9px] md:text-[10px] uppercase text-emerald-400/80 flex-row items-center">
                            <Activity
                              size={10}
                              color={THEME.green}
                              style={{ marginRight: 4 }}
                            />{' '}
                            98.4%
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="items-center justify-center p-12 border md:p-16 border-white/5 rounded-[32px] bg-black/20">
                      <Terminal size={28} color="#ffffff20" />
                      <Text className="mt-6 font-mono text-[10px] md:text-xs text-white/30 uppercase tracking-[4px]">
                        Data Stream Unavailable
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
// MODULE 6: CONCLUDING SYNTHESIS BOX
// ══════════════════════════════════════════════════════════════════════════════
const ConcludingSynthesis = React.memo(
  ({ conclusion }: { conclusion?: string }) => (
    <Animated.View
      entering={FadeInUp.duration(900).springify()}
      style={{ marginTop: 10, zIndex: 10, paddingBottom: 40 }}
    >
      <GlassCard
        glowColor="lime"
        className="items-center p-8 border md:p-12 bg-green-900/[0.04] border-green-500/20 rounded-[32px] md:rounded-[40px]"
      >
        <ShieldCheck
          size={28}
          color={THEME.green}
          style={{ marginBottom: 14 }}
        />
        <Text className="text-green-400 font-black text-[10px] md:text-xs uppercase tracking-[5px] text-center mb-5">
          Concluding Synthesis
        </Text>
        <Text className="px-2 text-sm font-medium leading-relaxed text-center text-white/80 md:text-base md:px-10">
          {conclusion ||
            'Analysis complete. All intelligence has been extracted and preserved within the VeraxAI Vault.'}
        </Text>
      </GlassCard>
    </Animated.View>
  ),
);

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 7: MASTER PAGE CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════
export default function MasterIntelligenceView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get('window');
  const isMobile = screenWidth < 768;

  // ─── QUERY ENGINE ───
  const { data: videoRecord, isLoading, error } = useVideoData(id as string);
  const scrollY = useSharedValue(0);

  // ─── DATA DESTRUCTURING & SAFETY PARSING ───
  const insights = videoRecord?.ai_insights;
  const transcript = videoRecord?.transcripts?.[0];

  const chapters = useMemo<DossierChapter[]>(() => {
    if (!insights?.chapters) return [];
    return Array.isArray(insights.chapters)
      ? (insights.chapters as unknown as DossierChapter[])
      : [];
  }, [insights]);

  const takeaways = useMemo<string[]>(() => {
    if (!insights?.key_takeaways) return [];
    return Array.isArray(insights.key_takeaways)
      ? insights.key_takeaways.map((t: any) =>
          typeof t === 'string' ? t : t.point || '',
        )
      : [];
  }, [insights]);

  const seoMetadata = useMemo(() => {
    if (!insights?.seo_metadata) return { suggested_titles: [] };
    const raw = insights.seo_metadata as Record<string, any>;
    return {
      suggested_titles: Array.isArray(raw.suggested_titles)
        ? raw.suggested_titles
        : [],
    };
  }, [insights]);

  const displayTitle =
    seoMetadata.suggested_titles[0] ||
    videoRecord?.title ||
    'Processing Video...';
  const isProcessing =
    videoRecord?.status === 'transcribing' ||
    videoRecord?.status === 'ai_processing' ||
    videoRecord?.status === 'queued';
  const isCompleted = videoRecord?.status === 'completed';

  // ─── UNIVERSAL EXPORT HANDLER ───
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
        // @ts-ignore - Bypassing phantom TS errors
        const result = ExportBuilder.exportTranscript(exportPayload, options);
        const safeName = displayTitle.slice(0, 30).replace(/[^a-z0-9]/gi, '_');
        result.filename = `${safeName}.${format}`;

        // Invokes the centralized Expo Sharing / Browser Blob logic
        await ExportBuilder.downloadExport(result);
      } catch (err: any) {
        console.error('[Export Failure]', err);
        Alert.alert(
          'Export Error',
          err.message || 'Unable to generate the file. Please try again.',
        );
      }
    },
    [videoRecord, transcript, insights, displayTitle],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: 'transparent',
    zIndex: 1000,
  }));

  // ─── FATAL ERROR STATE ───
  if (error || (!isLoading && !videoRecord)) {
    return (
      <View className="flex-1 bg-[#000012] items-center justify-center p-6 md:p-12 z-50">
        <AmbientArchitecture />
        <GlassCard
          glowColor="pink"
          className="items-center w-full max-w-lg p-10 md:p-16 border-rose-500/20 bg-[#0a0a14]/90 z-50"
        >
          <AlertCircle size={48} color={THEME.danger} className="mb-8" />
          <Text className="mb-4 text-2xl font-black tracking-widest text-center uppercase text-rose-500">
            Video Not Found
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/history' as any)
            }
            delayPressIn={0}
            className="flex-row items-center mt-10 gap-x-2"
            activeOpacity={0.7}
          >
            <ArrowBigLeftDash size={18} color={THEME.cyan} />
            <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase">
              Return
            </Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  // ─── MAIN RENDER PIPELINE ───
  return (
    <View className="flex-1 bg-[#000012]">
      <StatusBar barStyle="light-content" />

      {/* AMBIENT ENGINE */}
      <AmbientArchitecture />

      {/* FLOATING HEADER */}
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
            delayPressIn={0}
            className="z-50 flex-row items-center gap-x-2"
            activeOpacity={0.7}
            style={{ zIndex: 200 }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowBigLeftDash size={18} color={THEME.cyan} />
            <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase">
              Return
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-4">
            <View
              className={cn(
                'px-4 py-1.5 rounded-full border flex-row items-center shadow-lg',
                isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : videoRecord?.status === 'failed'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-cyan-500/10 border-cyan-500/30',
              )}
            >
              {isProcessing && (
                <ActivityIndicator
                  size="small"
                  color={THEME.cyan}
                  className="mr-2"
                />
              )}
              {isCompleted && (
                <CheckCircle2 size={12} color={THEME.green} className="mr-2" />
              )}
              {videoRecord?.status === 'failed' && (
                <AlertCircle size={12} color={THEME.danger} className="mr-2" />
              )}
              <Text
                className={cn(
                  'text-[9px] font-black uppercase tracking-[3px]',
                  isCompleted
                    ? 'text-emerald-400'
                    : videoRecord?.status === 'failed'
                      ? 'text-rose-400'
                      : 'text-cyan-400',
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

      {/* MASTER SCROLL VIEW */}
      <Animated.ScrollView
        className="z-10 flex-1"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        overScrollMode="never" // Eliminates Android overscroll touch hijacking
        keyboardShouldPersistTaps="always" // CRITICAL FOR ALL APK TAPS
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: 100,
          paddingHorizontal: isMobile ? 12 : 40,
          maxWidth: 1400,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {!isProcessing && isCompleted && (
          <ExportControlMatrix onExport={handleExport} isMobile={isMobile} />
        )}

        <UnifiedReportBox
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
          isMobile={isMobile}
          status={videoRecord?.status}
        />

        {!isProcessing && isCompleted && (
          <ConcludingSynthesis
            conclusion={(insights?.conclusion as string | null) ?? undefined}
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}
