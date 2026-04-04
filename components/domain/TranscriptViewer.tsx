/**
 * components/domain/TranscriptViewer.tsx
 * Sovereign Interactive Intelligence Viewer
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. DUAL-RENDER ENGINE: Toggles between Raw Verbatim and Segmented Timeline.
 * 2. NEURAL MAPPING: Connects timestamps to Deepgram segments.
 * 3. DIARIZATION SUPPORT: Distinct styling for detected speakers.
 * 4. PERFORMANCE TUNED: Uses memoization to prevent lag on long 1hr+ transcripts.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Transcript, TranscriptSegment, Chapter } from '../../types/api';
import { formatTimestamp } from '../../utils/formatters/time';
import { cn } from '../../lib/utils';
import {
  Clock,
  AlignLeft,
  ListTree,
  Copy,
  User,
  Hash,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { FadeIn } from '../animations/FadeIn';

interface TranscriptViewerProps {
  transcript: Transcript | null | undefined;
  chapters?: Chapter[];
  activeColor?: string;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  chapters = [],
  activeColor = '#00F0FF',
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'raw'>('timeline');

  // 1. NEURAL DATA PARSING
  // Safely extract segments from the Deepgram/Scraper JSON payload
  const segments: TranscriptSegment[] = useMemo(() => {
    if (!transcript?.transcript_json) return [];

    // Support for both direct arrays and object-wrapped segments
    if (Array.isArray(transcript.transcript_json))
      return transcript.transcript_json;
    if (transcript.transcript_json.segments)
      return transcript.transcript_json.segments;

    return [];
  }, [transcript]);

  // 2. COPY LOGIC
  const copyRaw = async () => {
    if (transcript?.transcript_text) {
      await Clipboard.setStringAsync(transcript.transcript_text);
    }
  };

  if (!transcript) {
    return (
      <View className="p-12 border border-white/5 bg-white/[0.01] rounded-[40px] items-center justify-center">
        <Hash size={32} color="#ffffff20" />
        <Text className="mt-4 text-white/20 font-mono text-[10px] uppercase tracking-[5px]">
          Awaiting_Data_Stream
        </Text>
      </View>
    );
  }

  return (
    <View className="w-full">
      {/* ── INTERFACE CONTROLS ────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-2 mb-6">
        <View className="flex-row bg-white/[0.03] border border-white/10 rounded-2xl p-1">
          <TouchableOpacity
            onPress={() => setViewMode('timeline')}
            className={cn(
              'flex-row items-center px-4 py-2 rounded-xl transition-all',
              viewMode === 'timeline' ? 'bg-blue-500/20' : 'bg-transparent',
            )}
          >
            <Clock
              size={14}
              color={viewMode === 'timeline' ? activeColor : '#ffffff40'}
            />
            <Text
              className={cn(
                'ml-2 text-[10px] font-bold uppercase tracking-widest',
                viewMode === 'timeline' ? 'text-blue-400' : 'text-white/40',
              )}
            >
              Timeline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('raw')}
            className={cn(
              'flex-row items-center px-4 py-2 rounded-xl transition-all',
              viewMode === 'raw' ? 'bg-blue-500/20' : 'bg-transparent',
            )}
          >
            <AlignLeft
              size={14}
              color={viewMode === 'raw' ? activeColor : '#ffffff40'}
            />
            <Text
              className={cn(
                'ml-2 text-[10px] font-bold uppercase tracking-widest',
                viewMode === 'raw' ? 'text-blue-400' : 'text-white/40',
              )}
            >
              Verbatim
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={copyRaw}
          className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl active:scale-95"
        >
          <Copy size={16} color="#fff" opacity={0.4} />
        </TouchableOpacity>
      </View>

      {/* ── RENDERING ENGINE ─────────────────────────────────────────── */}
      <View className="min-h-[400px]">
        {viewMode === 'timeline' ? (
          segments.length > 0 ? (
            <View className="gap-y-6">
              {segments.map((seg, idx) => {
                // Find if this segment falls under a specific chapter
                const currentChapter = chapters.find((c) => {
                  const [m, s] = c.timestamp.split(':').map(Number);
                  const chapterSec = m * 60 + s;
                  return seg.start >= chapterSec && seg.start < chapterSec + 30; // 30s window logic
                });

                return (
                  <FadeIn key={`${idx}-${seg.start}`} delay={idx * 30}>
                    <View className="flex-row">
                      {/* Left: Metadata Gutter */}
                      <View className="w-20 pt-1">
                        <Text className="text-[10px] font-mono text-blue-400 font-bold opacity-60">
                          {formatTimestamp(seg.start)}
                        </Text>
                        {seg.speaker && (
                          <View className="flex-row items-center mt-1">
                            <User size={8} color="#A855F7" />
                            <Text className="ml-1 text-[8px] font-black text-purple-400 uppercase">
                              SPK_{seg.speaker}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Right: Content Card */}
                      <View className="relative flex-1 pb-6 pl-6 border-l border-white/5">
                        {/* Chapter Indicator Dot */}
                        {currentChapter && (
                          <View className="absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full bg-blue-400 shadow-[0_0_10px_#00F0FF]" />
                        )}

                        {currentChapter && (
                          <Text className="text-[9px] font-black text-blue-400 uppercase tracking-[2px] mb-2">
                            Chapter: {currentChapter.title}
                          </Text>
                        )}

                        <Text className="text-sm font-medium leading-7 text-white/80 md:text-base">
                          {seg.text}
                        </Text>
                      </View>
                    </View>
                  </FadeIn>
                );
              })}
            </View>
          ) : (
            /* Fallback if segments are missing but raw text exists */
            <View className="p-8 border border-white/10 bg-white/[0.02] rounded-[40px]">
              <View className="flex-row items-center mb-6">
                <ListTree size={16} color="#fbbf24" />
                <Text className="ml-3 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  Metadata Limited: Falling back to raw stream
                </Text>
              </View>
              <Text className="text-base italic leading-8 text-white/60">
                {transcript.transcript_text}
              </Text>
            </View>
          )
        ) : (
          /* RAW VERBATIM VIEW */
          <FadeIn>
            <View className="p-10 border border-white/10 bg-white/[0.01] rounded-[40px]">
              <Text className="text-lg font-light leading-9 tracking-tight text-white/70">
                {transcript.transcript_text}
              </Text>

              <View className="flex-row items-center justify-between pt-8 mt-12 border-t border-white/5">
                <View>
                  <Text className="text-white/20 text-[9px] font-black uppercase tracking-[3px]">
                    Decryption Method
                  </Text>
                  <Text className="text-blue-400/50 font-mono text-[10px] mt-1 uppercase">
                    {transcript.extraction_method || 'Unknown_Node'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white/20 text-[9px] font-black uppercase tracking-[3px]">
                    Total Bitrate
                  </Text>
                  <Text className="text-white/40 font-mono text-[10px] mt-1">
                    {transcript.word_count || 0} WORDS
                  </Text>
                </View>
              </View>
            </View>
          </FadeIn>
        )}
      </View>
    </View>
  );
};
