//lib/api/queue.ts
import { supabase } from '../supabase/client';
import { Database } from '../../types/database/database.types';
import { parseVideoUrl } from '../../utils/videoParser';

type VideoInsert = Database['public']['Tables']['videos']['Insert'];

/**
 * Submits a batch of YouTube URLs for processing.
 * Creates a batch_jobs record and queues all videos.
 */
export const submitBatchJob = async (
  userId: string, // ← FIXED: was workspaceId (doesn't exist)
  videoUrls: string[],
  batchName: string,
) => {
  // Create the batch job record
  const { data: batch, error: batchError } = await supabase
    .from('batch_jobs')
    .insert({
      user_id: userId,
      name: batchName,
      status: 'processing',
      total_videos: videoUrls.length,
      completed_videos: 0,
      failed_videos: 0,
    })
    .select('id')
    .single();

  if (batchError) throw batchError;

  // Create video records for each URL
  const videoInserts: VideoInsert[] = videoUrls.map((url) => {
    const parsed = parseVideoUrl(url);
    const videoId = parsed.videoId;
    if (!videoId) throw new Error(`Invalid YouTube URL: ${url}`);

    return {
      user_id: userId,
      batch_job_id: batch.id,
      youtube_url: url,
      youtube_video_id: videoId,
      status: 'queued' as const,
    };
  });

  const { error: videosError } = await supabase
    .from('videos')
    .insert(videoInserts);

  if (videosError) throw videosError;

  return batch.id;
};
