import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import { Database } from '../types/database/database.types';
import { parseVideoUrl } from '../utils/videoParser';
import { fetchClientCaptions } from '../utils/clientCaptions';
import { ContentDifficulty, ProcessVideoRequest } from '../types/api';
import { useLocalAIStore } from './useLocalAIStore';
import { runLocalInference } from '../services/localInference';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

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
  difficulty: ContentDifficulty;
}

interface ExtendedProcessRequest extends ProcessVideoRequest {
  skip_ai?: boolean;
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

  setActiveVideoId: (id: string | null) => void;
  setError: (error: string | null) => void;
  fetchUserVideos: () => Promise<void>;
  processNewVideo: (url: string, options: ProcessingOptions) => Promise<void>;
  recordEvent: (name: string, severity?: PipelineEvent['severity'], details?: string) => void;
  syncStatus: (status: VideoStatus, error?: string | null) => void;
  refreshLocalVideo: (data: Partial<VideoRow>) => void;
  setActiveJob: (video: VideoRow) => void;
  clearState: () => void;
  hardReset: () => void;
  clearActiveVideo: () => void;
}

const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackName: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`TIMEOUT: ${fallbackName} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const useVideoStore = create<VideoState>((set, get) => ({
  videos: [],
  activeVideoId: null,
  status: null,
  isProcessing: false,
  error: null,
  pipelineEvents: [],
  jobStartTime: null,
  jobEndTime: null,

  setActiveVideoId: (id) => set({ activeVideoId: id, error: null }),

  setError: (error) => set({ error }),

  recordEvent: (event, severity = 'info', details) => {
    const newEvent: PipelineEvent = { event, timestamp: Date.now(), severity, details };
    set((state) => ({
      pipelineEvents: [newEvent, ...state.pipelineEvents].slice(0, 50)
    }));
    console.log(`[PIPELINE:${severity.toUpperCase()}] ${event} ${details ? `- ${details}` : ''}`);
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
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
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
    } catch (error: unknown) {
      recordEvent('SYNC_FAILURE', 'error', error instanceof Error ? error.message : String(error));
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
        throw new Error('AUTHENTICATION_FAILURE: Token expired. Please sign in again.');
      }

      recordEvent('SIGNATURE_ANALYSIS', 'info', 'Parsing media source format...');
      const parsed = parseVideoUrl(url);
      if (!parsed.isValid || !parsed.videoId || !parsed.normalizedUrl) {
        throw new Error('INCOMPATIBLE_SOURCE: Provided URL format is malformed or unsupported.');
      }

      recordEvent('PARALLEL_INIT', 'info', 'Executing DB Provisioning and Native Extraction concurrently...');

      const [dbResult, clientTranscriptResult] = await Promise.allSettled([
        supabase.from('videos').insert({
          user_id: session.user.id,
          platform: parsed.platform,
          youtube_url: parsed.normalizedUrl,
          youtube_video_id: parsed.videoId,
          status: 'queued',
        }).select().single(),
        withTimeout(fetchClientCaptions(parsed.videoId, parsed.platform), 3000, 'Caption_Proxy')
      ]);

      if (dbResult.status === 'rejected' || !dbResult.value.data) {
        throw new Error(`CRITICAL_DB_ERROR: ${dbResult.status === 'rejected' ? dbResult.reason : 'Provisioning failed.'}`);
      }

      const videoRecord = dbResult.value.data;
      targetDbId = videoRecord.id;
      set((state) => ({ activeVideoId: targetDbId, videos: [videoRecord, ...state.videos] }));

      let clientTranscript: string | null = null;
      if (clientTranscriptResult.status === 'fulfilled' && clientTranscriptResult.value) {
        clientTranscript = clientTranscriptResult.value;
        recordEvent('FAST_PATH_CAPTIONS', 'success', `Secured verbatim transcript natively.`);
      } else {
        recordEvent('FAST_PATH_CAPTIONS', 'warn', 'Native proxy timed out. Fluidly escalating to Verbum Edge.');
      }

      // --- TRANSPARENCY & ROUTING LOGIC ---
      const localState = useLocalAIStore.getState();
      const activeModel = localState.activeModelId;
      const isLocalModelReady = Boolean(activeModel && localState.downloadedModels.includes(activeModel));

      if (isLocalModelReady) {
        recordEvent('HYBRID_MODE_ENGAGED', 'success', `Local Engine active (${activeModel}). Will route extraction locally to save API tokens.`);
      } else {
        recordEvent('CLOUD_MODE_ENGAGED', 'info', `No Local Engine detected. Routing extraction to Premium Cloud API.`);
      }

      recordEvent('SERVER_HANDOFF', 'info', 'Relaying payload to Edge Processing Node...');

      const requestPayload: ExtendedProcessRequest = {
        video_id: targetDbId,
        video_url: parsed.normalizedUrl,
        language: options.language,
        difficulty: options.difficulty,
        transcript_text: clientTranscript,
        audio_url: null,
        skip_ai: isLocalModelReady // Tells the Edge function to STOP after Deepgram and return the text.
      };

      const edgeResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/process-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestPayload),
        }
      );

      if (!edgeResponse.ok) {
        const errJson = await edgeResponse.json().catch(() => ({}));
        throw new Error(errJson.error || `NODE_GATEWAY_REFUSED: HTTP ${edgeResponse.status}`);
      }

      const result = await edgeResponse.json();

      if (result.success === false) {
        throw new Error(result.error || 'The remote Edge Node encountered a fatal processing error.');
      }

      // --- LOCAL HANDOFF: The device takes over processing ---
      if (result.is_local_handoff && activeModel) {
        recordEvent('LOCAL_EXECUTION_INIT', 'info', 'Edge extraction complete. Booting Gemma Engine locally...');

        try {
          // PERFECT SYNC: We combine the system_instruction and user_message exactly as the Edge function returns them
          const structuredPrompt = `${result.system_instruction}\n\n${result.user_message}`;

          const rawLocalOutput = await runLocalInference(
            structuredPrompt,
            (token) => {
              // Intentionally left blank to save background thread performance
            }
          );

          recordEvent('LOCAL_EXECUTION_DONE', 'success', 'Local generation complete. Validating JSON schema...');

          // ELITE JSON EXTRACTOR
          let parsedInsights: any;
          try {
            const firstBrace = rawLocalOutput.indexOf('{');
            const lastBrace = rawLocalOutput.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1) {
              throw new Error("No JSON object bounds found in model output.");
            }
            const cleanJsonString = rawLocalOutput.substring(firstBrace, lastBrace + 1);
            parsedInsights = JSON.parse(cleanJsonString);
          } catch (jsonErr) {
            console.error("Local Engine JSON Failure:", rawLocalOutput);
            throw new Error("The local model failed to output a strictly formatted JSON object.");
          }

          // Flawless DB Sync
          const { error: insightError } = await supabase.from('ai_insights').upsert({
            video_id: targetDbId,
            summary: parsedInsights.summary || "Summary generation failed.",
            conclusion: parsedInsights.conclusion || null,
            chapters: Array.isArray(parsedInsights.chapters) ? parsedInsights.chapters : [],
            key_takeaways: Array.isArray(parsedInsights.key_takeaways) ? parsedInsights.key_takeaways : [],
            seo_metadata: parsedInsights.seo_metadata || {},
            ai_model: `Local: ${activeModel}`,
            language: options.language,
            processed_at: new Date().toISOString()
          });

          if (insightError) throw new Error(`LOCAL_SYNC_FAIL: ${insightError.message}`);

          // TELEMETRY: Log 0 tokens used since it ran locally to save costs
          await supabase.from('usage_logs').insert({
            user_id: session.user.id,
            video_id: targetDbId,
            action: 'ai_insights_generated',
            ai_model: `Local: ${activeModel}`,
            tokens_consumed: 0,
            duration_seconds: Math.floor((Date.now() - get().jobStartTime!) / 1000),
            metadata: { api_key_name: 'Local_SoC_Execution' }
          });

          await supabase.from('videos').update({
            status: 'completed',
            processing_completed_at: new Date().toISOString()
          }).eq('id', targetDbId);

          recordEvent('PIPELINE_FINALIZED', 'success', 'Local inference complete. Vault synchronized.');

        } catch (localErr: unknown) {
          const msg = localErr instanceof Error ? localErr.message : String(localErr);
          throw new Error(`LOCAL_HARDWARE_FAULT: ${msg}`);
        }
      } else {
        // Cloud executed it flawlessly
        recordEvent('PIPELINE_FINALIZED', 'success', 'Cloud Assets compiled and stored in vault.');
      }

      set({ jobEndTime: Date.now() });
      await get().fetchUserVideos();

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      recordEvent('PIPELINE_CRASH', 'error', errMsg);
      set({ error: errMsg, isProcessing: false });

      if (targetDbId) {
        await supabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: errMsg,
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