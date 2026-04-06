/**
 * components/domain/TranscriptViewer.tsx
 * Sovereign Interactive Intelligence Viewer
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. SIDE-BY-SIDE ARCHITECTURE: Timeline and Raw Text are displayed simultaneously.
 * 2. VERTICAL LINE CHART: Connects chapter nodes with a continuous tracking line to the absolute bottom.
 * 3. MASSIVE DATA HANDLING: Optimized Text rendering with strict overflow protection.
 * 4. STRICT TYPES: Accepts exact undefined/string types to satisfy Supabase schema.
 */

import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Chapter } from '../../types/api';
import { cn } from '../../lib/utils';
import { Milestone, Zap, Terminal } from 'lucide-react-native';
import { FadeIn } from '../animations/FadeIn';

interface TranscriptViewerProps {
  transcriptText?: string;
  chapters?: Chapter[];
  extractionMethod?: string;
  wordCount?: number;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcriptText,
  chapters = [],
  extractionMethod,
  wordCount,
}) => {
  const hasChapters = chapters && chapters.length > 0;

  return (
    <View className="w-full pt-10 mt-10 border-t border-white/5">
      <View className="flex-col gap-12 lg:flex-row lg:gap-16">
        {/* ── LEFT COLUMN: TIMELINE MAPPING (Purple Line Chart) ── */}
        {hasChapters && (
          <FadeIn delay={200} className="w-full lg:w-2/5 xl:w-1/3">
            <View className="flex-row items-center mb-10">
              <Milestone size={22} color="#C084FC" />
              <Text className="text-white/50 text-[11px] md:text-xs font-black uppercase tracking-[5px] ml-4">
                Timeline Mapping
              </Text>
            </View>

            {/* CRITICAL FIX: Added pb-8 so the absolute line can reach the bottom cleanly */}
            <View className="relative pb-8 pl-2 md:pl-4">
              {/* Continuous Vertical Line stretching to bottom-0 */}
              <View className="absolute left-[41px] md:left-[45px] top-6 bottom-0 w-[2px] bg-white/10 rounded-full" />

              {chapters.map((chapter, idx) => (
                <View
                  key={idx}
                  className="relative flex-row items-start mb-10 group"
                >
                  {/* Glowing Node Dot */}
                  <View className="absolute left-[36px] md:left-[40px] top-[14px] w-[12px] h-[12px] rounded-full bg-[#07070E] border-[2px] border-purple-500 shadow-[0_0_15px_#C084FC] z-10 transition-transform group-hover:scale-125 group-hover:bg-purple-400" />

                  {/* Timestamp Label */}
                  <View className="items-end pt-1 pr-6 w-14 md:w-16">
                    <Text className="text-[10px] md:text-[11px] font-bold font-mono text-purple-400/80 group-hover:text-purple-400 transition-colors">
                      {chapter.timestamp}
                    </Text>
                  </View>

                  {/* Chapter Content Summary */}
                  <View className="flex-1 p-6 md:p-8 bg-[#0a0a14]/90 border border-white/5 rounded-[30px] ml-4 shadow-lg transition-all group-hover:bg-[#0f0f1a] group-hover:border-white/10 group-hover:-translate-y-1">
                    <Text className="mb-3 text-lg font-black tracking-tight text-white md:text-xl">
                      {chapter.title}
                    </Text>
                    {chapter.description && (
                      <Text className="text-sm font-medium leading-relaxed transition-colors text-white/50 md:text-base group-hover:text-white/80">
                        {chapter.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </FadeIn>
        )}

        {/* ── RIGHT COLUMN: RAW VERBATIM TRANSCRIPT ── */}
        <FadeIn
          delay={300}
          className={cn(
            'w-full flex-1',
            hasChapters ? 'lg:w-3/5 xl:w-2/3' : 'lg:w-full',
          )}
        >
          <View className="flex-row items-center mb-10">
            <Zap size={22} color="#34D399" />
            <Text className="text-white/50 text-[11px] md:text-xs font-black uppercase tracking-[5px] ml-4">
              Verbatim Data Stream
            </Text>
          </View>

         {transcriptText ? (
            <View className="p-6 md:p-12 border bg-[#05050A]/80 border-white/5 rounded-[40px] relative shadow-2xl w-full">
              <View className="absolute top-0 right-0 w-full h-40 bg-emerald-500/5 blur-[80px]" pointerEvents="none" />

              {/* SURGICAL FIX: Removed flex-1 wrapper. Added raw CSS to force word wrapping so it never stretches the screen */}
              <Text
                className="w-full text-base font-medium tracking-wide md:text-lg text-white/80"
                style={{
                  lineHeight: Platform.OS === 'web' ? 42 : 36,
                  textAlign: 'justify',
                  ...(Platform.OS === 'web' ? { wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' } as any : {})
                }}
              >
                {transcriptText}
              </Text>

              {/* CRITICAL FIX: Overflow hidden wrapper to strictly contain the text on Web/Mobile */}
              <View className="flex-1 w-full overflow-hidden">
                <Text
                  className="flex-shrink w-full text-base font-medium tracking-wide md:text-lg leading-[36px] md:leading-[42px] text-white/80"
                  style={{
                    textAlign: 'justify',
                    flexShrink: 1,
                    ...(Platform.OS === 'web'
                      ? ({
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        } as any)
                      : {}),
                  }}
                >
                  {transcriptText}
                </Text>
              </View>
              
              {/* Technical Footer */}

<View className="flex-row items-center justify-between w-full pt-10 mt-12 overflow-hidden border-t border-white/5">
                <View>
                  <Text className="text-white/30 text-[9px] md:text-[10px] font-black uppercase tracking-[3px]">
                    Decryption Node
                  </Text>
                  <Text className="mt-2 font-mono text-[10px] md:text-xs uppercase text-emerald-400/80">
                    {extractionMethod || 'SYSTEM_DEFAULT'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white/30 text-[9px] md:text-[10px] font-black uppercase tracking-[3px]">
                    Data Volume
                  </Text>
                  <Text className="mt-2 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/70">
                    {wordCount?.toLocaleString() || 0} WORDS
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="items-center justify-center p-16 border border-white/5 rounded-[40px] bg-black/20">
              <Terminal size={32} color="#ffffff20" />
              <Text className="mt-6 font-mono text-xs text-white/30 uppercase tracking-[4px]">
                Data Stream Unavailable
              </Text>
            </View>
          )}
        </FadeIn>
      </View>
    </View>
  );
};
