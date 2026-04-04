import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { useVideoStore } from '../../store/useVideoStore';
import { Database } from '../../types/database/database.types';

type VideoRow = Database['public']['Tables']['videos']['Row'];

export const useRealtimeVideoStatus = (videoId: string | null) => {
  const queryClient = useQueryClient();
  const { setActiveVideo, updateStatus, updateVideoData } = useVideoStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['video', videoId],
    queryFn: async () => {
      if (!videoId) return null;
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      return data as VideoRow;
    },
    enabled: !!videoId,
  });

  useEffect(() => {
    if (data) setActiveVideo(data);
  }, [data, setActiveVideo]);

  useEffect(() => {
    if (!videoId) return;

    const channel = supabase
      .channel(`video-realtime-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`,
        },
        (payload) => {
          const updatedRow = payload.new as VideoRow;
          
          updateStatus(updatedRow.status, updatedRow.error_message);
          updateVideoData(updatedRow);

          queryClient.setQueryData(['video', videoId], updatedRow);

          if (updatedRow.status === 'completed') {
            queryClient.invalidateQueries({ queryKey: ['transcripts', videoId] });
            queryClient.invalidateQueries({ queryKey: ['ai_insights', videoId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, updateStatus, updateVideoData, queryClient]);

  return { data, isLoading, error };
};