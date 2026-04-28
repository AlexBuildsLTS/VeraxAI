/**
 * hooks/mutations/useProcessVideo.ts
 * Pipeline Dispatcher — Enterprise Universal Architecture
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - UNIVERSAL COMPATIBILITY: Uses `expo-crypto` to guarantee UUID generation
 * works flawlessly across Web, Android, and iOS without engine crashes.
 * - ANTI-CRASH GUARANTEE: mutationFn NEVER throws. Resolves safely to prevent 
 * React Native LogBox red screens.
 * - QUALITY GATE: Client captions require 50+ words to bypass Edge scraping.
 * - ATOMIC DB WRITES: Failure states are pushed to Supabase BEFORE local cache 
 * clearing to ensure perfect real-time UI synchronization.
 * - LOCAL INTERCEPTION: Seamlessly routes to on-device hardware if activated.
 * - TELEMETRY SYNC: Accurately logs 0-token local runs to usage_logs for charts.
 * ----------------------------------------------------------------------------
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto'; // UNIVERSAL: Works on Web, iOS, and Android
import { supabase } from '../../lib/supabase/client';
import { useVideoStore } from '../../store/useVideoStore';
import { parseVideoUrl, fetchVideoTitle } from '../../utils/videoParser';
import { fetchClientCaptions } from '../../utils/clientCaptions';

// Local AI Integration
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { runLocalInference } from '../../services/localInference';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// ─── MINIMUM QUALITY GATE ────────────────────────────────────────────────────
// Client-scraped captions under this threshold are considered unreliable.
// Discarding them forces the edge function through its own scraper/audio tiers.
const CLIENT_CAPTION_MIN_WORDS = 50;

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ProcessVideoParams {
    videoUrl: string;
    language?: string;
    difficulty?: string;
}

interface DispatchResult {
    success: boolean;
    videoId?: string;
    errorMsg?: string;
}

// ─── USER-FACING ERROR MASKING ───────────────────────────────────────────────
function maskErrorMessage(rawMsg: string): string {
    if (
        rawMsg.includes('ALL_AUDIO_PROVIDERS_EXHAUSTED') ||
        rawMsg.includes('TRANSCRIPTION_FAILED') ||
        rawMsg.includes('HTTP 404')
    ) {
        return "We couldn't extract audio for this video due to platform restrictions. Please try another link.";
    }
    if (rawMsg.includes('UNAUTHORIZED')) {
        return 'Your session has expired. Please sign in again.';
    }
    if (rawMsg.includes('INVALID_MEDIA')) {
        return 'The provided URL is not a valid or supported video link.';
    }
    if (rawMsg.includes('DB_INIT_FAILED')) {
        return 'Failed to initialize the process. Please check your connection and try again.';
    }
    if (rawMsg.includes('EDGE_HTTP_ERROR')) {
        return 'The processing server is temporarily unavailable. Please try again shortly.';
    }
    if (rawMsg.includes('LOCAL_AI_ERROR')) {
        return 'The local AI engine encountered an error. Please try again or disable Local AI in settings to use cloud processing.';
    }
    return 'An unexpected error occurred while processing the media.';
}

// ─── HOOK ────────────────────────────────────────────────────────────────────
export const useProcessVideo = () => {
    const queryClient = useQueryClient();
    const setActiveVideoId = useVideoStore((s) => s.setActiveVideoId);
    const setError = useVideoStore((s) => s.setError);
    const clearActiveVideo = useVideoStore((s) => s.clearActiveVideo);

    return useMutation({
        mutationFn: async ({
            videoUrl,
            language = 'English',
            difficulty = 'standard',
        }: ProcessVideoParams): Promise<DispatchResult> => {
            let activeUuid: string | null = null;
            const processStartTime = Date.now();

            try {
                const videoStore = useVideoStore.getState();
                videoStore.hardReset();
                videoStore.recordEvent('AUTH_CHECK', 'info', 'Verifying user session...');

                // ── 1. URL VALIDATION ──────────────────────────────────────────────
                const parsed = parseVideoUrl(videoUrl);
                if (!parsed.isValid || !parsed.videoId || !parsed.normalizedUrl) {
                    return {
                        success: false,
                        errorMsg: 'INVALID_MEDIA: URL format not recognised.',
                    };
                }

                // ── 2. SESSION ASSERTION ───────────────────────────────────────────
                const {
                    data: { session },
                    error: authError,
                } = await supabase.auth.getSession();

                if (authError || !session?.user) {
                    return { success: false, errorMsg: 'UNAUTHORIZED: Session required.' };
                }

                // ── 3. FETCH THE ACTUAL VIDEO TITLE ───────────────────────────────
                videoStore.recordEvent('VALIDATION', 'info', 'Fetching video metadata...');
                const officialTitle = await fetchVideoTitle(parsed.normalizedUrl);

                // ── 4. DB ROW INITIALISATION ───────────────────────────────────────
                videoStore.recordEvent('DATABASE', 'info', 'Creating secure vault record...');
                const videoUuid = Crypto.randomUUID();
                activeUuid = videoUuid;

                const { data: videoRecord, error: dbError } = await supabase.from('videos').insert({
                    id: videoUuid,
                    user_id: session.user.id,
                    youtube_url: parsed.normalizedUrl,
                    youtube_video_id: parsed.videoId,
                    title: officialTitle,
                    platform: parsed.platform,
                    status: 'queued',
                }).select().single();

                if (dbError || !videoRecord) {
                    return {
                        success: false,
                        errorMsg: `DB_INIT_FAILED: ${dbError?.message}`,
                    };
                }

                // Activate polling/realtime
                setActiveVideoId(videoUuid);
                // Pre-populate UI state for instant feedback
                useVideoStore.setState((state) => ({
                    videos: [videoRecord, ...state.videos]
                }));

                // ── 5. CLIENT CAPTION FAST-PATH (quality-gated) ───────────────────
                let clientTranscript: string | null = null;

                try {
                    const raw = await fetchClientCaptions(parsed.videoId, parsed.platform);

                    if (raw && raw.split(/\s+/).length >= CLIENT_CAPTION_MIN_WORDS) {
                        clientTranscript = raw;
                    }
                } catch {
                    // Silent: CORS block on web or network error. Edge handles it gracefully.
                }

                // ── 5.5. LOCAL AI ROUTING CHECK ────────────────────────────────────
                const localState = useLocalAIStore.getState();
                const activeModel = localState.activeModelId;
                const isLocalModelReady = Boolean(activeModel && localState.downloadedModels.includes(activeModel));

                if (isLocalModelReady) {
                    videoStore.recordEvent(
                        'LOCAL_MODE',
                        'success',
                        `Local AI enabled (${activeModel}). Processing transcript on-device to save API tokens.`
                    );
                } else {
                    videoStore.recordEvent(
                        'CLOUD_MODE',
                        'info',
                        `Routing to Cloud API for insight generation.`
                    );
                }

                videoStore.recordEvent('PROCESSING', 'info', 'Extracting audio and generating transcript...');

                // ── 6. EDGE FUNCTION DISPATCH ──────────────────────────────────────
                const response = await fetch(
                    `${SUPABASE_URL}/functions/v1/process-video`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            apikey: SUPABASE_ANON_KEY,
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            video_id: videoUuid,
                            video_url: parsed.normalizedUrl,
                            platform: parsed.platform,
                            transcript_text: clientTranscript,
                            language,
                            difficulty,
                            skip_ai: isLocalModelReady, // Intercepts Gemini in the cloud!
                        }),
                    },
                );

                if (!response.ok) {
                    return {
                        success: false,
                        errorMsg: `EDGE_HTTP_ERROR: ${response.status}`,
                        videoId: videoUuid,
                    };
                }

                const data = await response.json();

                if (!data.success) {
                    return {
                        success: false,
                        errorMsg: data.error ?? 'EDGE_PROCESSING_FAILED',
                        videoId: videoUuid,
                    };
                }

                // ── 7. LOCAL AI EXECUTION (IF HANDOFF RECEIVED) ─────────────────────
                if (data.is_local_handoff && activeModel) {
                    videoStore.recordEvent('LOCAL_AI_START', 'info', 'Transcript received. Starting local AI analysis...');
                    const localExecStartTime = Date.now();

                    try {
                        const structuredPrompt = `Analyze the following transcript. You MUST output ONLY a valid JSON object matching this exact schema:
{
  "summary": "A detailed paragraph summarizing the content",
  "conclusion": "A brief 2-sentence final thought",
  "chapters": [{"title": "String", "timestamp": "MM:SS", "description": "String"}],
  "key_takeaways": ["Point 1", "Point 2"],
  "seo_metadata": {"tags": ["tag1"], "description": "Meta desc"}
}
Do not include markdown blocks or conversational text. Output pure JSON.

Transcript:
${data.transcript || clientTranscript}`;

                        // Execute on Native Device Hardware
                        const rawLocalOutput = await runLocalInference(structuredPrompt, () => { });

                        videoStore.recordEvent('LOCAL_AI_SUCCESS', 'success', 'Local analysis complete. Formatting results...');

                        let parsedInsights: any;
                        try {
                            const firstBrace = rawLocalOutput.indexOf('{');
                            const lastBrace = rawLocalOutput.lastIndexOf('}');
                            if (firstBrace === -1 || lastBrace === -1) {
                                throw new Error("No JSON object bounds found in model output.");
                            }
                            parsedInsights = JSON.parse(rawLocalOutput.substring(firstBrace, lastBrace + 1));
                        } catch (jsonErr) {
                            console.error("Local JSON Validation Failure:", rawLocalOutput);
                            throw new Error("The local model failed to format the response correctly.");
                        }

                        // Upsert directly to DB
                        const { error: insightError } = await supabase.from('ai_insights').upsert({
                            video_id: videoUuid,
                            summary: parsedInsights.summary || "Summary generation failed.",
                            conclusion: parsedInsights.conclusion || null,
                            chapters: Array.isArray(parsedInsights.chapters) ? parsedInsights.chapters : [],
                            key_takeaways: Array.isArray(parsedInsights.key_takeaways) ? parsedInsights.key_takeaways : [],
                            seo_metadata: parsedInsights.seo_metadata || {},
                            ai_model: `Local: ${activeModel}`,
                            language,
                            processed_at: new Date().toISOString()
                        });

                        if (insightError) throw new Error(`Database sync failed: ${insightError.message}`);

                        const durationSeconds = Math.floor((Date.now() - processStartTime) / 1000);

                        // --- TELEMETRY FIX: Log to usage_logs so charts work! ---
                        await supabase.from('usage_logs').insert({
                            user_id: session.user.id,
                            video_id: videoUuid,
                            action: 'ai_insights_generated',
                            ai_model: `Local: ${activeModel}`,
                            tokens_consumed: 0, // 0 Cloud Tokens Burned!
                            duration_seconds: durationSeconds,
                            metadata: { local_execution: true }
                        });

                        await supabase.from('videos').update({
                            status: 'completed',
                            processing_completed_at: new Date().toISOString(),
                            processing_duration_ms: Date.now() - processStartTime
                        }).eq('id', videoUuid);

                        videoStore.recordEvent('SUCCESS', 'success', 'Local insights saved successfully! Dashboard updated.');
                    } catch (localErr: unknown) {
                        const msg = localErr instanceof Error ? localErr.message : String(localErr);
                        return { success: false, errorMsg: `LOCAL_AI_ERROR: ${msg}`, videoId: videoUuid };
                    }
                } else {
                    // Cloud executed it
                    videoStore.recordEvent('SUCCESS', 'success', 'Cloud insights generated and saved successfully!');
                }

                return { success: true, videoId: videoUuid };
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    success: false,
                    errorMsg: msg,
                    videoId: activeUuid ?? undefined,
                };
            }
        },

        onSuccess: async (result: DispatchResult) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['video-history'] });
                queryClient.invalidateQueries({ queryKey: ['videos'] });
                return;
            }

            // ── FAILURE HANDLING ─────────────────────────────────────────────────
            const rawMsg = result.errorMsg ?? 'Unknown error';
            console.log('[useProcessVideo] Pipeline failure:', rawMsg);

            // Persist failed status to DB FIRST so polling/history reflects it
            if (result.videoId) {
                await supabase
                    .from('videos')
                    .update({
                        status: 'failed',
                        error_message: rawMsg,
                        processing_completed_at: new Date().toISOString(),
                    })
                    .eq('id', result.videoId);

                queryClient.invalidateQueries({ queryKey: ['video-history'] });
                queryClient.invalidateQueries({
                    queryKey: ['video_relational', result.videoId],
                });
            }

            // Surface clean error message in the UI
            setError(maskErrorMessage(rawMsg));

            // Clear the active video AFTER DB write + cache invalidation
            if (clearActiveVideo) clearActiveVideo();
        },
    });
};