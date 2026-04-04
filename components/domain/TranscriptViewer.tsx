import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useVideoStore } from '../../store/useVideoStore';
import { useVideoData } from '../../hooks/queries/useVideoData';
import { GlassCard } from '../ui/GlassCard';
import { FadeIn } from '../animations/FadeIn';
import { cn } from '../../lib/utils';

export const TranscriptViewer: React.FC = () => {
  const activeVideoId = useVideoStore((state) => state.activeVideoId);
  const status = useVideoStore((state) => state.status);

  // Real-time hook listening to the database
  const { data: video, isLoading } = useVideoData(activeVideoId);

  const transcriptContent = useMemo(() => {
    if (!video?.transcripts || video.transcripts.length === 0) return null;
    return video.transcripts[0].transcript_text;
  }, [video]);

  if (isLoading && !video) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#00F0FF" />
        <Text className="text-white/50 mt-4 font-mono text-[10px] uppercase tracking-[4px]">
          Decrypting Payload...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
      <FadeIn duration={600}>
        <GlassCard className="mb-6 p-6 md:p-8 bg-white/[0.02]" glowColor="cyan">
          <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-white/10">
            <Text className="text-xl font-black text-white tracking-widest uppercase">
              Raw <Text className="text-neon-cyan">Transcript</Text>
            </Text>
            <StatusIndicator status={status || video?.status || 'queued'} />
          </View>

          {transcriptContent ? (
            <Text className="text-slate-300 leading-8 text-base md:text-lg font-medium selection:bg-neon-cyan/30">
              {transcriptContent}
            </Text>
          ) : (
            <View className="py-16 items-center">
              <ActivityIndicator color="#8A2BE2" />
              <Text className="text-white/40 mt-6 text-center font-mono text-[9px] uppercase tracking-widest">
                {status === 'transcribing'
                  ? 'Deepgram Node Active: Resolving Audio...'
                  : 'Initializing Extraction Pipeline...'}
              </Text>
            </View>
          )}
        </GlassCard>
      </FadeIn>
    </ScrollView>
  );
};

// Internal Helper for the UI
const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; text: string }> = {
    queued: { color: 'bg-white/20 text-white', text: 'Standby' },
    downloading: {
      color: 'bg-neon-purple/20 text-neon-purple',
      text: 'Extracting',
    },
    transcribing: {
      color: 'bg-neon-pink/20 text-neon-pink',
      text: 'Decrypting',
    },
    ai_processing: {
      color: 'bg-neon-cyan/20 text-neon-cyan',
      text: 'Analyzing',
    },
    completed: { color: 'bg-neon-lime/20 text-neon-lime', text: 'Secured' },
    failed: { color: 'bg-red-500/20 text-red-500', text: 'Corrupted' },
  };

  const current = config[status] || config.queued;

  return (
    <View
      className={cn(
        'px-3 py-1.5 rounded-full border border-current',
        current.color,
      )}
    >
      <Text className="text-[9px] font-black uppercase tracking-[3px]">
        {current.text}
      </Text>
    </View>
  );
};

export default TranscriptViewer;
