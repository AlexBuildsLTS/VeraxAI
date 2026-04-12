/**
 * app/(dashboard)/video/[id].tsx
 * Master Intelligence Dossier - VerAI Monolithic Layout
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * 1. RESPONSIVE MATRIX: Export buttons scroll horizontally on mobile to prevent squishing.
 * 2. MOBILE TIMELINE: Natural flex-column stacking so expanding pushes content down.
 * 3. COMPACT TRANSCRIPT: Auto-formatted paragraphs in a restricted ScrollView.
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
} from 'react-native-reanimated';

// ─── INTERNAL DEPENDENCIES ───────────────────────────────────────────────────
import { useVideoData } from '../../../hooks/queries/useVideoData';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ExportBuilder } from '../../../services/exportBuilder';
import { cn } from '../../../lib/utils';
import { parseTimestamp } from '../../../utils/formatters/time';
import type { Video, Transcript, AiInsights } from '../../../types/api';

// ─── LOCAL TYPES TO MATCH DATABASE ───────────────────────────────────────────
interface DossierChapter {
  title: string;
  timestamp?: string;
  description?: string;
}

// ─── CONSTANTS & PALETTE ─────────────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DARK_NAVY = '#000012';
const CYAN = '#00F0FF';
const PURPLE = '#8A2BE2';
const GREEN = '#32FF00';
const PINK = '#FF007F';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: AMBIENT ORB ENGINE (APK TOUCH-SAFE)
// ══════════════════════════════════════════════════════════════════════════════
const AmbientOrb = ({
  color,
  size,
  top,
  left,
  right,
  bottom,
  opacity = 0.09,
  delay = 0,
}: {
  color: string;
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  opacity?: number;
  delay?: number;
}) => {
  const { width, height } = Dimensions.get('window');
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, drift]);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, width * 0.15]) },
      { translateY: interpolate(drift.value, [0, 1], [0, height * 0.1]) },
      { scale: interpolate(drift.value, [0, 1], [0.9, 1.1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity,
          top,
          left,
          right,
          bottom,
          pointerEvents: 'none', // CRITICAL FIX: Ensures ambient elements never block touches
        },
        anim,
      ]}
    />
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: EXPORT MATRIX COMPONENT
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
      { id: 'md', label: 'MD', icon: FileText, color: '#FCD34D' },
      { id: 'srt', label: '(SRT)', icon: Terminal, color: '#F472B6' },
      { id: 'json', label: 'JSON', icon: Layers, color: '#A855F7' },
      { id: 'txt', label: 'TXT', icon: AlignLeft, color: '#60A5FA' },
    ];

    const [busyId, setBusyId] = useState<string | null>(null);

    const handlePress = async (id: 'md' | 'srt' | 'json' | 'txt') => {
      setBusyId(id);
      await onExport(id);
      setBusyId(null);
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(600).springify()}
        style={{
          zIndex: 30,
          width: '100%',
          marginBottom: 32, 
          paddingBottom: 16, 
        }}
      >
        <ScrollView
          horizontal={isMobile}
          showsHorizontalScrollIndicator={false}
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
              style={isMobile ? { width: 160 } : { flex: 1 }}
              className="flex-row items-center justify-between p-4 transition-all shadow-xl md:p-6 border rounded-2xl md:rounded-[24px] bg-[#05050A]/90 border-white/10 hover:bg-white/[0.04]"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <format.icon
                  size={isMobile ? 16 : 18}
                  color={format.color}
                  strokeWidth={2.5}
                  opacity={0.9}
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
// MODULE 3: CHAPTER TIMELINES (DESKTOP & MOBILE VARIANTS)
// ══════════════════════════════════════════════════════════════════════════════

// DESKTOP: Proportional mapping. Fixes overlap by boosting zIndex of opened item.
const ProportionalChapterTimeline = ({
  chapters,
  totalDurationSeconds,
  containerHeight,
}: {
  chapters: DossierChapter[];
  totalDurationSeconds: number | null;
  containerHeight: number;
}) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!chapters.length || containerHeight <= 0) return null;

  const usableHeight = Math.max(containerHeight - 80, 40);

  const getY = (ch: DossierChapter, i: number): number => {
    if (totalDurationSeconds && totalDurationSeconds > 0 && ch.timestamp) {
      const secs = parseTimestamp(ch.timestamp);
      if (secs !== null && secs >= 0) {
        return Math.min(secs / totalDurationSeconds, 0.98) * usableHeight;
      }
    }
    return (i / Math.max(chapters.length - 1, 1)) * usableHeight;
  };

  return (
    <View
      style={{ position: 'relative', height: containerHeight, width: '100%' }}
    >
      <View
        style={{
          position: 'absolute',
          left: 45,
          top: 10,
          bottom: 0,
          width: 2,
          backgroundColor: PURPLE + '20',
          borderRadius: 2,
        }}
      />

      {chapters.map((ch, i) => {
        const yPos = getY(ch, i);
        const isOpen = openIdx === i;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => setOpenIdx(isOpen ? null : i)}
            activeOpacity={0.9}
            style={{
              position: 'absolute',
              top: yPos,
              left: 0,
              right: 0,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
              zIndex: isOpen ? 50 : i, // FIX: Pops the opened chapter over the others
            }}
          >
            <View style={{ width: 28, alignItems: 'flex-end', paddingTop: 2 }}>
              {ch.timestamp ? (
                <Text
                  style={{
                    color: isOpen ? CYAN : PURPLE,
                    fontSize: 10,
                    fontWeight: '700',
                    fontFamily: 'monospace',
                  }}
                >
                  {ch.timestamp}
                </Text>
              ) : null}
            </View>

            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                marginTop: 2,
                backgroundColor: DARK_NAVY,
                borderWidth: 2,
                borderColor: isOpen ? CYAN : PURPLE,
                shadowColor: isOpen ? CYAN : PURPLE,
                shadowOpacity: 0.8,
                shadowRadius: 8,
              }}
            />

            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                backgroundColor: isOpen ? '#05121F' : 'rgba(255,255,255,0.02)',
                borderColor: isOpen ? CYAN + '50' : 'rgba(255,255,255,0.05)',
                shadowColor: '#000',
                shadowOpacity: isOpen ? 0.5 : 0,
                shadowRadius: 10,
              }}
            >
              <Text
                style={{
                  color: isOpen ? CYAN : 'rgba(255,255,255,0.9)',
                  fontSize: 12,
                  fontWeight: '800',
                  marginBottom: 4,
                }}
              >
                {ch.title}
              </Text>
              {(isOpen || !ch.timestamp) && ch.description ? (
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    lineHeight: 22,
                    marginTop: 4,
                  }}
                >
                  {ch.description}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// MOBILE: Stacked list. Prevents overlap issues entirely because it uses natural flex layout.
const MobileChapterTimeline = ({
  chapters,
}: {
  chapters: DossierChapter[];
}) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <View className="pb-4 pl-6 ml-6 border-l-2 border-purple-500/20">
      {chapters.map((ch, i) => {
        const isOpen = openIdx === i;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => setOpenIdx(isOpen ? null : i)}
            activeOpacity={0.8}
            className="relative pl-6 mb-6"
          >
            <View
              style={{
                position: 'absolute',
                left: -9,
                top: 4,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: DARK_NAVY,
                borderWidth: 2,
                borderColor: isOpen ? CYAN : PURPLE,
                shadowColor: isOpen ? CYAN : PURPLE,
                shadowOpacity: 0.8,
                shadowRadius: 8,
              }}
            />

            <View
              className={cn(
                'p-4 rounded-2xl border transition-all',
                isOpen
                  ? 'bg-cyan-500/10 border-cyan-500/40'
                  : 'bg-white/[0.02] border-white/5',
              )}
            >
              <View className="flex-row items-start justify-between mb-1">
                <Text
                  className={cn(
                    'flex-1 text-sm font-bold pr-2 leading-5',
                    isOpen ? 'text-cyan-400' : 'text-white/90',
                  )}
                >
                  {ch.title}
                </Text>
                {ch.timestamp ? (
                  <Text
                    className={cn(
                      'text-[10px] font-mono font-bold mt-0.5',
                      isOpen ? 'text-cyan-400' : 'text-purple-400',
                    )}
                  >
                    {ch.timestamp}
                  </Text>
                ) : null}
              </View>
              {(isOpen || !ch.timestamp) && ch.description ? (
                <Text className="mt-2 text-xs leading-relaxed text-white/60">
                  {ch.description}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: THE UNIFIED MEGA-BOX COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
interface MegaBoxProps {
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
  durationSec?: number | null;
  isMobile: boolean;
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
    durationSec,
    isMobile,
  }: MegaBoxProps) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const [transcriptHeight, setTranscriptHeight] = useState(0);

    const MIN_TIMELINE_HEIGHT = Math.max(600, chapters.length * 100);

    const handleCopyAll = async () => {
      const payload = `TITLE: ${title}\n\nEXECUTIVE ABSTRACT:\n${summary || 'N/A'}\n\nVERBATIM TRANSCRIPT:\n${transcriptText || 'N/A'}`;
      await Clipboard.setStringAsync(payload);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(700).springify()}
        className="z-10 mb-8"
      >
        <GlassCard
          glowColor="cyan"
          className="p-0 bg-[#07070E]/95 border-white/5 rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl"
        >
          {/* ── PART A: HERO & TITLE ── */}
          <View className="px-6 pt-10 pb-8 border-b md:px-14 md:pt-12 bg-white/[0.01] border-white/5 relative overflow-hidden">
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 400,
                height: 400,
                backgroundColor: 'rgba(59,130,246,0.1)',
                borderRadius: 200,
                pointerEvents: 'none',
              }}
              className="blur-[120px]"
            />

            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-row items-center px-4 py-2 border rounded-full bg-cyan-500/10 border-cyan-500/30">
                <BookOpen size={14} color={CYAN} />
                <Text className="ml-3 text-[10px] font-black text-cyan-400 uppercase tracking-[4px]">
                  Video Report
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopyAll}
                className="z-20 flex-row items-center p-3 transition-colors border bg-white/[0.03] rounded-full hover:bg-white/10 active:scale-95 border-white/10 md:px-5 md:py-2.5"
              >
                {copySuccess ? (
                  <CheckCircle2 size={14} color={GREEN} />
                ) : (
                  <Copy size={14} color={CYAN} opacity={0.8} />
                )}
                <Text className="ml-2 text-[10px] font-black uppercase text-white/60 tracking-widest hidden md:flex">
                  Copy All
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-6 text-3xl font-black leading-tight tracking-tighter text-white md:text-5xl lg:text-6xl">
              {title || 'Untitled Video'}
            </Text>

            <View className="z-20 flex-row flex-wrap items-center gap-5 md:gap-8 opacity-80">
              {readingTime ? (
                <View className="flex-row items-center">
                  <Clock size={14} color={CYAN} />
                  <Text className="ml-2 font-mono text-[10px] tracking-[2px] text-white uppercase">
                    {Math.round(readingTime)} Min Read
                  </Text>
                </View>
              ) : null}
              {wordCount ? (
                <View className="flex-row items-center">
                  <AlignLeft size={14} color={CYAN} />
                  <Text className="ml-2 font-mono text-[10px] tracking-[2px] text-white uppercase">
                    {wordCount.toLocaleString()} Words
                  </Text>
                </View>
              ) : null}
              {youtubeUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(youtubeUrl)}
                  className="flex-row items-center transition-opacity hover:opacity-70"
                >
                  <ExternalLink size={14} color={PURPLE} />
                  <Text className="ml-2 text-purple-400 font-black text-[10px] uppercase tracking-[2px]">
                    View Source
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── LOADING STATE ── */}
          {isProcessing ? (
            <View className="items-center justify-center py-20 md:py-32">
              <ActivityIndicator size="large" color={CYAN} />
              <Text className="mt-8 text-cyan-400/60 font-mono text-[10px] md:text-xs uppercase tracking-[5px] text-center leading-loose">
                Decrypting Neural Matrix...{'\n'}Synthesizing Abstract &
                Verbatim Data.
              </Text>
            </View>
          ) : (
            <View className="px-5 py-8 md:px-14 md:py-12">
              {/* ── PART B: EXECUTIVE ABSTRACT ── */}
              <View className="mb-12 md:mb-16">
                <View className="flex-row items-center mb-6">
                  <Sparkles size={18} color={PURPLE} />
                  <Text className="text-purple-400 font-black text-[11px] md:text-xs uppercase tracking-[5px] ml-3">
                    Summary
                  </Text>
                </View>
                <Text className="text-white/80 leading-[28px] md:leading-[34px] text-sm md:text-base font-medium text-justify mb-10">
                  {summary || (
                    <Text className="italic opacity-50">
                      Summary pending or unavailable.
                    </Text>
                  )}
                </Text>

                {/* ── PART C: KEY TAKEAWAYS ── */}
                {takeaways.length > 0 && (
                  <View className="p-6 border md:p-8 bg-white/[0.015] border-white/5 rounded-[24px] md:rounded-[32px]">
                    <Text className="text-white/40 font-black text-[9px] md:text-[10px] uppercase tracking-[4px] mb-6">
                      Key Takeaways
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

              {/* ── PART D: TIMELINE AND FORMATTED RAW TEXT ── */}
              <View className="flex-col gap-10 lg:flex-row lg:gap-16">
                {/* LEFT COLUMN: TIMELINE */}
                {chapters.length > 0 && (
                  <View className="w-full lg:w-1/3">
                    <View className="flex-row items-center mb-8">
                      <Milestone size={18} color={PURPLE} />
                      <Text className="text-white/50 text-[10px] md:text-[11px] font-black uppercase tracking-[4px] ml-3">
                        Chapters
                      </Text>
                    </View>

                    {isMobile ? (
                      <MobileChapterTimeline chapters={chapters} />
                    ) : (
                      <View
                        style={{
                          height: Math.max(
                            transcriptHeight,
                            MIN_TIMELINE_HEIGHT,
                          ),
                        }}
                      >
                        <ProportionalChapterTimeline
                          chapters={chapters}
                          totalDurationSeconds={durationSec ?? null}
                          containerHeight={Math.max(
                            transcriptHeight,
                            MIN_TIMELINE_HEIGHT,
                          )}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* RIGHT COLUMN: SCROLLABLE FORMATTED TRANSCRIPT */}
                <View
                  className={cn(
                    'w-full',
                    chapters.length > 0 ? 'lg:flex-1' : 'lg:w-full',
                  )}
                >
                  <View className="flex-row items-center mb-8">
                    <Zap size={18} color={GREEN} />
                    <Text className="text-white/50 text-[10px] md:text-[11px] font-black uppercase tracking-[4px] ml-3">
                      Transcript
                    </Text>
                  </View>

                  {transcriptText ? (
                    <View
                      onLayout={(e) =>
                        setTranscriptHeight(e.nativeEvent.layout.height)
                      }
                      className="p-5 md:p-10 border bg-white/[0.015] border-white/5 rounded-[24px] md:rounded-[32px] relative overflow-hidden w-full"
                    >
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 80,
                          width: '100%',
                          height: 160,
                          backgroundColor: 'rgba(16,185,129,0.04)',
                          pointerEvents: 'none',
                        }}
                        className="blur-[80px]"
                      />

                      {/* FIX: Formatted, breathable text in a scroll window */}
                      <ScrollView
                        nestedScrollEnabled={true}
                        style={{ maxHeight: isMobile ? 450 : 600 }}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={{
                          paddingRight: 10,
                          paddingBottom: 20,
                        }}
                      >
                        {transcriptText.split('\n').map((paragraph, index) => {
                          if (!paragraph.trim()) return null;
                          return (
                            <Text
                              key={index}
                              className="mb-4 text-sm font-medium tracking-wide md:text-base text-white/70"
                              style={{
                                lineHeight: 28,
                                flexShrink: 2,
                                ...(IS_WEB
                                  ? ({
                                      wordBreak: 'break-word',
                                      whiteSpace: 'pre-wrap',
                                    } as any)
                                  : {}),
                              }}
                              selectable
                            >
                              {paragraph.trim()}
                            </Text>
                          );
                        })}
                      </ScrollView>

                      <View className="flex-row items-center justify-between pt-6 mt-4 border-t border-white/5">
                        <View>
                          <Text className="text-white/30 text-[8px] font-black uppercase tracking-[3px]">
                            Extraction Engine
                          </Text>
                          <Text className="mt-1.5 font-mono text-[9px] uppercase text-emerald-400/50">
                            {extractionMethod || 'SYSTEM DEFAULT'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="items-center justify-center p-12 border md:p-16 border-white/5 rounded-[32px] bg-black/20">
                      <Terminal size={28} color="#ffffff20" />
                      <Text className="mt-6 font-mono text-[10px] md:text-xs text-white/30 uppercase tracking-[4px]">
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
// MODULE 5: CONCLUDING SYNTHESIS BOX
// ══════════════════════════════════════════════════════════════════════════════
const ConcludingSynthesis = React.memo(
  ({ conclusion }: { conclusion?: string }) => (
    <Animated.View
      entering={FadeInUp.duration(900).springify()}
      style={{ marginTop: 20, zIndex: 10 }}
    >
      <GlassCard
        glowColor="lime"
        className="items-center p-8 border md:p-12 bg-green-900/[0.04] border-green-500/20 rounded-[32px] md:rounded-[40px]"
      >
        <ShieldCheck size={28} color={GREEN} style={{ marginBottom: 14 }} />
        <Text className="text-green-400 font-black text-[10px] md:text-xs uppercase tracking-[5px] text-center mb-5">
          Concluding Synthesis
        </Text>
        <Text className="px-2 text-sm font-medium leading-relaxed text-center text-white/80 md:text-base md:px-10">
          {conclusion ||
            'Analysis complete. All intelligence has been extracted and preserved.'}
        </Text>
      </GlassCard>
    </Animated.View>
  ),
);

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 6: MASTER PAGE CONTROLLER
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

  // ─── DATA DESTRUCTURING ───
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
    'Decrypted Media Payload';
  const isProcessing =
    videoRecord?.status === 'transcribing' ||
    videoRecord?.status === 'ai_processing' ||
    videoRecord?.status === 'queued';
  const isCompleted = videoRecord?.status === 'completed';

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
        // 1. Generate the raw text content
        const result = ExportBuilder.exportTranscript(exportPayload, options);

        // 2. Override the default filename with the actual Video Title
        const safeName = displayTitle.slice(0, 30).replace(/[^a-z0-9]/gi, '_');
        result.filename = `${safeName}.${format}`;

        // 3. Trigger the Universal Downloader (Handles Web & Mobile automatically!)
        await ExportBuilder.downloadExport(result);
      } catch (err) {
        console.error('[Export Failure]', err);
        Alert.alert(
          'Export Error',
          'Unable to generate the file. Please try again.',
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
        <AmbientOrb color={PINK} size={300} delay={0} />
        <GlassCard
          glowColor="pink"
          className="items-center w-full max-w-lg p-10 md:p-16 border-rose-500/20 bg-[#0a0a14]/90 z-50"
        >
          <AlertCircle size={48} color="#F43F5E" className="mb-8" />
          <Text className="mb-4 text-2xl font-black tracking-widest text-center uppercase text-rose-500">
            Node Unreachable
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/history' as any)
            }
            className="flex-row items-center mt-10 gap-x-2"
            activeOpacity={0.7}
          >
            <ArrowBigLeftDash size={18} color={CYAN} />
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
    <View className="flex-1 bg-[#000012]">
      <StatusBar barStyle="light-content" />

      <AmbientOrb color={CYAN} size={280} top={-50} left={-80} delay={0} />
      <AmbientOrb
        color={PURPLE}
        size={200}
        top={300}
        right={-50}
        delay={2000}
      />

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
            className="z-50 flex-row items-center gap-x-2"
            activeOpacity={0.7}
            style={{ zIndex: 200 }}
          >
            <ArrowBigLeftDash size={18} color={CYAN} />
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
                <CheckCircle2 size={12} color={GREEN} className="mr-2" />
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

      <Animated.ScrollView
        className="z-10 flex-1"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: 200,
          paddingHorizontal: isMobile ? 12 : 40,
          maxWidth: 1280,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {!isProcessing && isCompleted && (
          <ExportControlMatrix onExport={handleExport} isMobile={isMobile} />
        )}

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
          durationSec={videoRecord?.duration_seconds ?? null}
          isMobile={isMobile}
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
