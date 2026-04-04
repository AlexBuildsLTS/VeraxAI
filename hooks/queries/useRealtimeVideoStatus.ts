/**
 * hooks/queries/useRealtimeVideoStatus.ts
 * Real-time Database Listener & Cache Invalidater
 * ----------------------------------------------------------------------------
 * Connects to Supabase Realtime to listen for backend pipeline updates.
 * Perfectly synchronized with the enterprise useVideoStore methods.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { useVideoStore } from '../../store/useVideoStore';
import { Database } from '../../types/database/database.types';

type VideoRow = Database['public']['Tables']['videos']['Row'];

export const useRealtimeVideoStatus = (videoId: string | null) => {
  const queryClient = useQueryClient();
  
  // FIXED: Destructuring the exact method names exported by the updated useVideoStore
  const { setActiveJob, syncStatus, refreshLocalVideo } = useVideoStore();

  // Initial fetch of the video data
  const { data, isLoading, error } = useQuery({
    queryKey: ['video', videoId],
    queryFn: async () => {
      if (!videoId) return null;
      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (dbError) throw dbError;
      return dbData as VideoRow;
    },
    enabled: !!videoId,
  });

  // Synchronize the initial data load with our global store
  useEffect(() => {
    if (data) {
      setActiveJob(data);
    }
  }, [data, setActiveJob]);

  // Establish the Supabase Realtime WebSocket connection
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
          
          // FIXED: Using the synchronized store methods to update the UI instantly
          syncStatus(updatedRow.status, updatedRow.error_message);
          refreshLocalVideo(updatedRow);

          // Update React Query's internal cache
          queryClient.setQueryData(['video', videoId], updatedRow);

          // Once the backend orchestrator finishes, force a refetch of the final assets
          if (updatedRow.status === 'completed') {
            queryClient.invalidateQueries({ queryKey: ['transcripts', videoId] });
            queryClient.invalidateQueries({ queryKey: ['ai_insights', videoId] });
          }
        }
      )
      .subscribe();

    // Cleanup the WebSocket channel when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, syncStatus, refreshLocalVideo, queryClient]);

  return { data, isLoading, error };
};