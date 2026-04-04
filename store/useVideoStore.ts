/**
 * store/useVideoStore.ts
 * Ironclad State Management & Pipeline Orchestration
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. STRICT SYNC: Fully mapped to your updated database.types.ts schema.
 * 2. COMPATIBILITY: Method names mapped to fix useRealtimeVideoStatus.ts errors.
 * 3. FALLBACK SHIELDS: Safely hands off to backend if local fast-path fails.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import { Database } from '../types/database/database.types';
import { parseVideoUrl } from '../utils/videoParser';
import { fetchClientCaptions } from '../utils/clientCaptions';

type VideoRow = Database['public']['Tables']['videos']['Row'];
type VideoStatus = Database['public']['Enums']['video_status'];

interface PipelineEvent {
  event: string;
  timestamp: number;
  details?: string;
  severity: 'info' | 'warn' | 'error' | 'success';
}

interface ProcessingOptions {
  language: string;
  difficulty: string;
}

interface VideoState {
  videos: VideoRow[];
  activeVideoId: string | null;
  status: VideoStatus | null;
  isProcessing: boolean;
  error: string | null;

  pipelineEvents: PipelineEvent[];
  jobStartTime: number | null;
  jobEndTime: number | null;

  fetchUserVideos: () => Promise<void>;
  processNewVideo: (url: string, options: ProcessingOptions) => Promise<void>;

  recordEvent: (name: string, severity?: PipelineEvent['severity'], details?: string) => void;
  syncStatus: (status: VideoStatus, error?: string | null) => void;
  refreshLocalVideo: (data: Partial<VideoRow>) => void;
  setActiveJob: (video: VideoRow) => void;
  clearState: () => void;
  hardReset: () => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  videos: [],
  activeVideoId: null,
  status: null,
  isProcessing: false,
  error: null,
  pipelineEvents: [],
  jobStartTime: null,
  jobEndTime: null,

  recordEvent: (event, severity = 'info', details) => {
    const newEvent: PipelineEvent = { event, timestamp: Date.now(), severity, details };
    set((state) => ({
      pipelineEvents: [newEvent, ...state.pipelineEvents].slice(0, 50)
    }));
    console.log(`[PIPELINE:${severity.toUpperCase()}] ${event}`);
  },

  clearState: () => set({ error: null }),

  hardReset: () => set({
    pipelineEvents: [],
    jobStartTime: null,
    jobEndTime: null,
    error: null,
    isProcessing: false,
    activeVideoId: null,
    status: null
  }),

  // Method names synchronized for useRealtimeVideoStatus.ts
  setActiveJob: (video) =>
    set({
      activeVideoId: video.id,
      status: video.status,
      error: video.error_message,
    }),

  syncStatus: (status, error = null) => set({ status, error }),

  refreshLocalVideo: (data) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === state.activeVideoId ? { ...v, ...data } : v,
      ),
    })),

  fetchUserVideos: async () => {
    const { recordEvent } = get();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        recordEvent('SESSION_MISSING', 'warn', 'Fetch attempted without valid auth context.');
        return;
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ videos: data || [], error: null });
      recordEvent('DATA_SYNCED', 'success', `Loaded ${data?.length} historical records.`);
    } catch (error: any) {
      recordEvent('SYNC_FAILURE', 'error', error.message);
    }
  },

  processNewVideo: async (url, options) => {
    const { recordEvent, hardReset } = get();
    hardReset();
    set({ isProcessing: true, jobStartTime: Date.now() });

    let targetDbId: string | null = null;

    try {
      recordEvent('HANDSHAKE_INIT', 'info', 'Validating secure session token...');

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
        throw new Error('Authentication failure: Token expired. Please sign in again.');
      }

      recordEvent('SIGNATURE_ANALYSIS', 'info', 'Parsing media source format...');
      const parsed = parseVideoUrl(url);
      if (!parsed.isValid || !parsed.videoId || !parsed.normalizedUrl) {
        throw new Error('Incompatible Source: Provided URL format is malformed or unsupported.');
      }

      recordEvent('DB_PROVISIONING', 'info', `Target Media ID: ${parsed.videoId}`);
      const { data: videoRecord, error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: session.user.id,
          platform: parsed.platform,
          youtube_url: parsed.normalizedUrl,
          youtube_video_id: parsed.videoId,
          status: 'queued',
        })
        .select()
        .single();

      if (dbError || !videoRecord) {
        throw new Error(`Critical DB Error: ${dbError?.message || 'Provisioning failed.'}`);
      }

      targetDbId = videoRecord.id;
      set((state) => ({ activeVideoId: targetDbId, videos: [videoRecord, ...state.videos] }));

      recordEvent('FAST_PATH_INIT', 'info', 'Checking local edge cache for metadata...');
      let clientTranscript: string | null = null;
      try {
        clientTranscript = await fetchClientCaptions(parsed.videoId, parsed.platform);
        if (clientTranscript) {
          recordEvent('FAST_PATH_OK', 'success', 'Client-side metadata successfully secured.');
        }
      } catch (e) {
        recordEvent('FAST_PATH_FAIL', 'warn', 'Client limits reached. Bypassing to Sovereign Edge.');
      }

      recordEvent('SERVER_HANDOFF', 'info', 'Relaying payload to Edge Processing Node...');

      const edgeResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            video_id: targetDbId,
            video_url: parsed.normalizedUrl,
            platform: parsed.platform,
            transcript_text: clientTranscript,
            language: options.language,
            difficulty: options.difficulty,
          }),
        }
      );

      if (!edgeResponse.ok) {
        const errJson = await edgeResponse.json().catch(() => ({}));
        throw new Error(errJson.error || `Node Gateway Refused: HTTP ${edgeResponse.status}`);
      }

      const result = await edgeResponse.json();

      if (result.success === false) {
        throw new Error(result.error || 'The remote Edge Node encountered a fatal processing error.');
      }

      recordEvent('PIPELINE_FINALIZED', 'success', 'Assets compiled and stored in vault.');
      set({ jobEndTime: Date.now() });

      await get().fetchUserVideos();

    } catch (err: any) {
      recordEvent('PIPELINE_CRASH', 'error', err.message);
      set({ error: err.message, isProcessing: false });

      if (targetDbId) {
        await supabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: err.message,
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', targetDbId);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  clearActiveVideo: () => set({ activeVideoId: null, status: null, error: null }),
}));