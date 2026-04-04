/**
 * store/useVideoStore.ts
 * Enterprise-Grade State Management & Pipeline Orchestration
 * * Architecture: 
 * 1. Persistent Zustand state for global video context.
 * 2. Strict session management using local getSession() to bypass network blocks.
 * 3. Granular pipeline telemetry for high-fidelity UI feedback.
 * 4. Fault-tolerant handoff to sovereign Supabase Edge Functions.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import { Database } from '../types/database/database.types';
import { parseVideoUrl } from '../utils/videoParser';
import { fetchClientCaptions } from '../utils/clientCaptions';

type VideoRow = Database['public']['Tables']['videos']['Row'];
type VideoStatus = Database['public']['Enums']['video_status'];

interface PipelineTelemetry {
  step: 'initializing' | 'parsing' | 'db_init' | 'fast_path' | 'uplink' | 'syncing';
  timestamp: string;
  message: string;
}

interface ProcessingOptions {
  language: string;
  difficulty: string;
}

interface VideoState {
  // --- Core State ---
  videos: VideoRow[];
  activeVideoId: string | null;
  status: VideoStatus | null;
  isProcessing: boolean;
  error: string | null;
  
  // --- Telemetry & Analytics ---
  telemetry: PipelineTelemetry[];
  lastProcessedId: string | null;

  // --- Core Actions ---
  fetchUserVideos: () => Promise<void>;
  processNewVideo: (url: string, options: ProcessingOptions) => Promise<void>;
  
  // --- State Synchronization ---
  updateStatus: (status: VideoStatus, error?: string | null) => void;
  updateVideoData: (data: Partial<VideoRow>) => void;
  setActiveVideo: (video: VideoRow) => void;
  
  // --- Utilities ---
  clearActiveVideo: () => void;
  clearError: () => void;
  resetTelemetry: () => void;
  addTelemetry: (step: PipelineTelemetry['step'], message: string) => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  videos: [],
  activeVideoId: null,
  status: null,
  isProcessing: false,
  error: null,
  telemetry: [],
  lastProcessedId: null,

  // --- Utility Implementations ---
  clearError: () => set({ error: null }),
  
  resetTelemetry: () => set({ telemetry: [] }),

  addTelemetry: (step, message) => {
    const newLog: PipelineTelemetry = {
      step,
      message,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ telemetry: [newLog, ...state.telemetry].slice(0, 20) }));
    console.log(`[Pipeline:${step.toUpperCase()}] ${message}`);
  },

  setActiveVideo: (video) =>
    set({
      activeVideoId: video.id,
      status: video.status,
      error: video.error_message,
    }),

  updateStatus: (status, error = null) => set({ status, error }),

  updateVideoData: (data) =>
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === state.activeVideoId ? { ...v, ...data } : v,
      ),
    })),

  // --- Primary Data Actions ---
  fetchUserVideos: async () => {
    try {
      // Hardened session check (Local memory only to avoid 403 blocks)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        get().addTelemetry('syncing', 'No active session detected for fetch.');
        return;
      }

      const { data, error: dbError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      set({ videos: data || [], error: null });
      get().addTelemetry('syncing', `Successfully synchronized ${data?.length || 0} assets.`);
    } catch (error: any) {
      console.error('[Store] Sync Failure:', error.message);
    }
  },

  processNewVideo: async (url, options) => {
    // 0. Reset State for new Job
    set({ isProcessing: true, error: null, telemetry: [] });
    let dbRecordId: string | null = null;
    const { addTelemetry } = get();

    try {
      addTelemetry('initializing', 'Securing authentication handshake...');

      // 1. Session Validation (Local Context Only)
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
        throw new Error('Security context invalid. Please re-authenticate.');
      }

      // 2. Multi-Platform URL Parsing
      addTelemetry('parsing', 'Analyzing source URL integrity...');
      const parsed = parseVideoUrl(url);
      if (!parsed.isValid || !parsed.videoId || !parsed.normalizedUrl) {
        throw new Error('Source identifier could not be extracted from URL.');
      }

      addTelemetry('db_init', `Provisioning database record for ${parsed.platform}:${parsed.videoId}`);

      // 3. Database Persistence (Initial State)
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
        throw new Error(dbError?.message || 'Database provisioning failed.');
      }

      dbRecordId = videoRecord.id;
      set((state) => ({ 
        activeVideoId: dbRecordId,
        videos: [videoRecord, ...state.videos] 
      }));

      // 4. Phase 1: Client-Side Fast-Path (Optional)
      addTelemetry('fast_path', 'Attempting rapid metadata extraction...');
      let clientTranscript: string | null = null;
      try {
        // We try client-side, but do NOT throw if it fails. The backend is the sovereign.
        clientTranscript = await fetchClientCaptions(parsed.videoId, parsed.platform);
        if (clientTranscript) {
          addTelemetry('fast_path', 'Metadata successfully cached locally.');
        }
      } catch (e) {
        addTelemetry('fast_path', 'Fast-path bypassed. Backend will handle extraction.');
      }

      // 5. Phase 2: Uplink to Sovereign Edge Function
      addTelemetry('uplink', 'Establishing secure link to Edge Processing Node...');
      
      const edgeResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            video_id: dbRecordId,
            video_url: parsed.normalizedUrl,
            platform: parsed.platform,
            transcript_text: clientTranscript, // Pass what we found (if anything)
            language: options.language,
            difficulty: options.difficulty,
          }),
        }
      );

      // Handle Edge Function network failures
      if (!edgeResponse.ok) {
        const errorData = await edgeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Uplink failed with status code ${edgeResponse.status}`);
      }

      const result = await edgeResponse.json();

      if (result.success === false) {
        throw new Error(result.error || 'Server-side pipeline rejected the payload.');
      }

      addTelemetry('syncing', 'Processing sequence complete. Finalizing data sync...');
      
      // Final Refresh
      await get().fetchUserVideos();
      set({ lastProcessedId: dbRecordId });

    } catch (err: any) {
      addTelemetry('initializing', `Fatal Pipeline Error: ${err.message}`);
      set({ error: err.message });

      // Attempt to mark failure in DB so UI reflects correctly
      if (dbRecordId) {
        await supabase
          .from('videos')
          .update({ 
            status: 'failed', 
            error_message: err.message,
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', dbRecordId);
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  clearActiveVideo: () => set({ activeVideoId: null, status: null, error: null }),
}));