/**
 * hooks/mutations/useProcessVideo.ts
 * Pipeline Dispatcher — Enterprise Universal Architecture
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - UNIVERSAL COMPATIBILITY: Uses `expo-crypto` to guarantee UUID generation.
 * - ANTI-CRASH GUARANTEE: mutationFn NEVER throws. Resolves safely.
 * - TRUE HARDWARE AGNOSTIC: Zero artificial string truncation. If the transcript
 *   tokens fit the user's 'Prefill Context' slider, it processes locally.
 * - SMART ROUTING: If transcript exceeds the user's slider, safely routes to Cloud.
 * - ATOMIC DB WRITES: Failure states are pushed to Supabase BEFORE local cache.
 * - STRICT TYPING: Utilizes Database types for perfectly safe JSONB casting.
 * ----------------------------------------------------------------------------
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../lib/supabase/client';
import { useVideoStore } from '../../store/useVideoStore';
import { parseVideoUrl, fetchVideoTitle } from '../../utils/videoParser';
import { fetchClientCaptions } from '../../utils/clientCaptions';
import { Database } from '../../types/database/database.types';

// Local AI Integration
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { runLocalInference } from '../../services/localInference';

// ─── STRICT DB TYPE EXTRACTION ───────────────────────────────────────────────
type ChaptersType = Database['public']['Tables']['ai_insights']['Insert']['chapters'];
type TakeawaysType = Database['public']['Tables']['ai_insights']['Insert']['key_takeaways'];
type SeoMetaType = Database['public']['Tables']['ai_insights']['Insert']['seo_metadata'];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// ─── MINIMUM QUALITY GATE ────────────────────────────────────────────────────
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
    if (rawMsg.includes('JSON_FORMAT_ERROR')) {
        return 'The local model generated incomplete data. Try increasing "Max Decode Tokens" in settings.';
    }
    if (rawMsg.includes('LOCAL_AI_ERROR')) {
        return 'The local AI engine encountered an error. Please try again or disable Local AI in settings.';
    }
    return rawMsg; // Let specific UI feedback (like slider limits) fall through directly
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
                    return { success: false, errorMsg: 'INVALID_MEDIA: URL format not recognised.' };
                }

                // ── 2. SESSION ASSERTION ───────────────────────────────────────────
                const { data: { session }, error: authError } = await supabase.auth.getSession();
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
                    return { success: false, errorMsg: `DB_INIT_FAILED: ${dbError?.message}` };
                }

                setActiveVideoId(videoUuid);
                useVideoStore.setState((state) => ({ videos: [videoRecord, ...state.videos] }));

                // ── 5. CLIENT CAPTION FAST-PATH (quality-gated) ───────────────────
                let clientTranscript: string | null = null;
                try {
                    const raw = await fetchClientCaptions(parsed.videoId, parsed.platform);
                    if (raw && raw.split(/\s+/).length >= CLIENT_CAPTION_MIN_WORDS) {
                        clientTranscript = raw;
                    }
                } catch {
                    // Silent: Edge handles it gracefully.
                }

                // ── 5.5. HARDWARE-AGNOSTIC ROUTING ─────────────────────────────────
                const localState = useLocalAIStore.getState();
                const activeModel = localState.activeModelId;
                let isLocalModelReady = Boolean(activeModel && localState.downloadedModels.includes(activeModel));

                // If we have the transcript locally already, check its exact mathematical token weight
                if (isLocalModelReady && clientTranscript) {
                    // 1 token ~= 3.5 chars + 150 overhead for the prompt instructions
                    const estimatedTokens = Math.ceil(clientTranscript.length / 3.5) + 150;

                    if (estimatedTokens > localState.prefillTokens) {
                        videoStore.recordEvent(
                            'CLOUD_MODE',
                            'info',
                            `Transcript (~${estimatedTokens} tokens) exceeds your configured Prefill Context (${localState.prefillTokens}). Auto-routing to Cloud API.`
                        );
                        isLocalModelReady = false;
                    } else {
                        videoStore.recordEvent(
                            'LOCAL_MODE',
                            'success',
                            `Local AI enabled (${activeModel}). Processing on-device.`
                        );
                    }
                } else if (isLocalModelReady) {
                    videoStore.recordEvent('LOCAL_MODE', 'success', `Local AI ready. Waiting for Edge transcript extraction.`);
                } else {
                    videoStore.recordEvent('CLOUD_MODE', 'info', `Routing to Cloud API for insight generation.`);
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
                            skip_ai: isLocalModelReady, // Intercepts Gemini in the cloud if true!
                        }),
                    },
                );

                if (!response.ok) {
                    return { success: false, errorMsg: `EDGE_HTTP_ERROR: ${response.status}`, videoId: videoUuid };
                }

                const data = await response.json();

                if (!data.success) {
                    return { success: false, errorMsg: data.error ?? 'EDGE_PROCESSING_FAILED', videoId: videoUuid };
                }

                // ── 7. LOCAL AI EXECUTION (IF HANDOFF RECEIVED) ─────────────────────
                if (data.is_local_handoff && activeModel) {
                    const rawText = data.transcript || clientTranscript || '';

                    // The Edge Function returned the Deepgram transcript. We must verify token weight before passing to C++
                    const estimatedServerTokens = Math.ceil(rawText.length / 3.5) + 150;

                    if (estimatedServerTokens > localState.prefillTokens) {
                        return {
                            success: false,
                            errorMsg: `Transcript too large (~${estimatedServerTokens} tokens) for your current Prefill Context limit (${localState.prefillTokens}). Increase the slider in Hardware settings or disable Local AI.`,
                            videoId: videoUuid
                        };
                    }

                    videoStore.recordEvent('LOCAL_AI_START', 'info', 'Transcript fits memory limit. Starting local AI analysis...');

                    try {
                        // Hardened JSON-Only Prompt. 
                        // ENTIRE rawText is passed. NO artificial truncation.
                        const structuredPrompt = `You are a strict data extraction AI. Analyze the transcript below. You MUST output ONLY a valid JSON object. 
DO NOT wrap the output in markdown code blocks. DO NOT add conversational text. Start directly with { and end with }.

{
  "summary": "A detailed paragraph summarizing the content.",
  "conclusion": "A brief 2-sentence final thought.",
  "chapters": [{"title": "String", "timestamp": "MM:SS", "description": "String"}],
  "key_takeaways": ["Point 1", "Point 2"],
  "seo_metadata": {"tags": ["tag1"], "description": "Meta desc"}
}

Transcript:
${rawText}`;

                        // Execute on Native Device Hardware
                        const rawLocalOutput = await runLocalInference(structuredPrompt, () => { });
                        videoStore.recordEvent('LOCAL_AI_SUCCESS', 'success', 'Local generation complete. Validating schema...');

                        // ELITE JSON SANITIZATION
                        let parsedInsights: Record<string, unknown>;
                        try {
                            let sanitized = rawLocalOutput.replace(/```json/gi, '').replace(/```/g, '').trim();

                            const firstBrace = sanitized.indexOf('{');
                            const lastBrace = sanitized.lastIndexOf('}');

                            if (firstBrace === -1 || lastBrace === -1) {
                                if (rawLocalOutput.length < 15) throw new Error("CONTEXT_OVERFLOW");
                                throw new Error("JSON_FORMAT_ERROR");
                            }

                            const cleanJsonString = sanitized.substring(firstBrace, lastBrace + 1);
                            parsedInsights = JSON.parse(cleanJsonString);
                        } catch (jsonErr) {
                            console.error("Local JSON Extraction Failure. Raw Output:", rawLocalOutput);
                            if (jsonErr instanceof Error && jsonErr.message === 'CONTEXT_OVERFLOW') throw jsonErr;
                            throw new Error("JSON_FORMAT_ERROR");
                        }

                        // Upsert directly to DB with STRICT DB Type Casting
                        const { error: insightError } = await supabase.from('ai_insights').upsert({
                            video_id: videoUuid,
                            summary: (parsedInsights.summary as string) || "Summary generation failed.",
                            conclusion: (parsedInsights.conclusion as string) || null,
                            chapters: (Array.isArray(parsedInsights.chapters) ? parsedInsights.chapters : []) as unknown as ChaptersType,
                            key_takeaways: (Array.isArray(parsedInsights.key_takeaways) ? parsedInsights.key_takeaways : []) as unknown as TakeawaysType,
                            seo_metadata: (parsedInsights.seo_metadata ?? null) as unknown as SeoMetaType,
                            ai_model: `Local: ${activeModel}`,
                            language,
                            processed_at: new Date().toISOString()
                        });

                        if (insightError) throw new Error(`Database sync failed: ${insightError.message}`);

                        const durationSeconds = Math.floor((Date.now() - processStartTime) / 1000);

                        // TELEMETRY SYNC
                        await supabase.from('usage_logs').insert({
                            user_id: session.user.id,
                            video_id: videoUuid,
                            action: 'ai_insights_generated',
                            ai_model: `Local: ${activeModel}`,
                            tokens_consumed: 0,
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
                return { success: false, errorMsg: msg, videoId: activeUuid ?? undefined };
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
                queryClient.invalidateQueries({ queryKey: ['video_relational', result.videoId] });
            }

            setError(maskErrorMessage(rawMsg));

            if (clearActiveVideo) clearActiveVideo();
        },
    });
};