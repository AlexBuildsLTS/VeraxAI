import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { Database } from '../../types/database/database.types';

type VideoRow = Database['public']['Tables']['videos']['Row'];

/**
 * useHistoryData
 * Fetches the complete list of video processing history for the current user.
 * Strictly typed against the Supabase Database schema.
 */
export const useHistoryData = () => {
  return useQuery<VideoRow[]>({
    queryKey: ['video-history'],
    
    queryFn: async () => {
      // Get the current user to ensure we only fetch their data
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User must be authenticated to fetch history.');
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id) // Filter by authenticated user
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useHistoryData] Database Error:', error);
        throw new Error(error.message);
      }

      return data as VideoRow[];
    },
    // Keep history fresh but don't over-fetch
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};
