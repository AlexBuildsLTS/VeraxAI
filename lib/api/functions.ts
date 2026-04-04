import { supabase } from '../supabase/client';

export const EdgeFunctions = {
  async processVideo(
    videoId: string,
    videoUrl: string,
    language: string = 'english',
  ) {
    // MATCHING THE EDGE FUNCTION EXPECTATION: snake_case
    const { data, error } = await supabase.functions.invoke('process-video', {
      body: {
        video_id: videoId, // FIXED: was videoId
        video_url: videoUrl, // FIXED: was videoUrl
        language,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to trigger video processing');
    }

    return data;
  },
};
