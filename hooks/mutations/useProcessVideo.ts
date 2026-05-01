/**
 * @file hooks/mutations/useProcessVideo.ts
 * @description Pipeline Dispatcher — Universal Architecture
 * ----------------------------------------------------------------------------
 * UPDATES (Post-April 22nd):
 * - SAFE STRING EXTRACTION: Replaced backtick regex with index-based slicing.
 * - MEMORY FENCING: Explicitly releases native engine before Cloud routing.
 * - JSON REPAIR: Enhanced reconstruction for swallowed opening braces.
 * ----------------------------------------------------------------------------
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../lib/supabase/client';
import { useVideoStore } from '../../store/useVideoStore';
import { parseVideoUrl, fetchVideoTitle } from '../../utils/videoParser';
import { fetchClientCaptions } from '../../utils/clientCaptions';
import type { Database } from '../../types/database/database.types';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { runLocalInference, releaseNativeEngine } from '../../services/localInference';

type ChaptersType = Database['public']['Tables']['ai_insights']['Insert']['chapters'];
type TakeawaysType = Database['public']['Tables']['ai_insights']['Insert']['key_takeaways'];
type SeoMetaType = Database['public']['Tables']['ai_insights']['Insert']['seo_metadata'];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;
const CLIENT_CAPTION_MIN_WORDS = 50;

interface ProcessVideoParams { videoUrl: string; language?: string; difficulty?: string; }
interface DispatchResult { success: boolean; videoId?: string; errorMsg?: string; }

function maskErrorMessage(rawMsg: string): string {
    if (rawMsg.includes('ALL_AUDIO_PROVIDERS_EXHAUSTED')) return "We couldn't extract audio for this video due to platform restrictions. Please try another link.";
    if (rawMsg.includes('UNAUTHORIZED')) return 'Your session has expired. Please sign in again.';
    if (rawMsg.includes('INVALID_MEDIA')) return 'The provided URL is not a valid or supported video link.';
    if (rawMsg.includes('DB_INIT_FAILED')) return 'Failed to initialize the process. Please check your connection and try again.';
    if (rawMsg.includes('EDGE_HTTP_ERROR')) return 'The processing server is temporarily unavailable. Please try again shortly.';
    return rawMsg;
}

function extractAndParseJSON(rawOutput: string) {
    // AVOID REGEX BACKTICKS: Use safe string searching to prevent Metro crashes
    const firstBrace = rawOutput.indexOf('{');
    const lastBrace = rawOutput.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        // Attempt aggressive reconstruction if the model swallowed the start
        const summaryIndex = rawOutput.indexOf('"summary"');
        if (summaryIndex !== -1) {
            const reconstructed = '{' + rawOutput.substring(summaryIndex);
            const finalBrace = reconstructed.lastIndexOf('}');
            if (finalBrace !== -1) return JSON.parse(reconstructed.substring(0, finalBrace + 1));
        }
        throw new Error("No JSON boundaries found.");
    }

    const cleanJsonString = rawOutput.substring(firstBrace, lastBrace + 1);

    try {
        return JSON.parse(cleanJsonString);
    } catch (e) {
        // Final cleanup for common Q4 quantization artifacts (trailing commas/control chars)
        const repaired = cleanJsonString
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/[\u0000-\u001F]+/g, "");
        return JSON.parse(repaired);
    }
}

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

                const parsed = parseVideoUrl(videoUrl);
                if (!parsed.isValid || !parsed.videoId || !parsed.normalizedUrl) {
                    return { success: false, errorMsg: 'INVALID_MEDIA: URL format not recognised.' };
                }

                const { data: { session }, error: authError } = await supabase.auth.getSession();
                if (authError || !session?.user) return { success: false, errorMsg: 'UNAUTHORIZED: Session required.' };

                videoStore.recordEvent('VALIDATION', 'info', 'Fetching video metadata...');
                const officialTitle = await fetchVideoTitle(parsed.normalizedUrl);

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

                if (dbError || !videoRecord) return { success: false, errorMsg: `DB_INIT_FAILED: ${dbError?.message || 'Unknown Error'}` };

                setActiveVideoId(videoUuid);
                useVideoStore.setState((state) => ({ videos: [videoRecord, ...state.videos] }));

                let clientTranscript: string | null = null;
                try {
                    const raw = await fetchClientCaptions(parsed.videoId, parsed.platform);
                    if (raw && raw.split(/\s+/).length >= CLIENT_CAPTION_MIN_WORDS) clientTranscript = raw;
                } catch { }

                const localState = useLocalAIStore.getState();
                const activeModel = localState.activeModelId;
                let isLocalModelReady = Boolean(activeModel && localState.downloadedModels.includes(activeModel));

                // Context size calculation for routing
                if (isLocalModelReady && clientTranscript) {
                    const estimatedTokens = Math.ceil(clientTranscript.length / 3.2) + 200;
                    if (estimatedTokens > localState.prefillTokens) {
                        videoStore.recordEvent('CLOUD_MODE', 'warn', `Transcript (${estimatedTokens} tokens) exceeds Context slider limit. Freeing VRAM and routing to Cloud...`);
                        await releaseNativeEngine();
                        isLocalModelReady = false;
                    } else {
                        videoStore.recordEvent('LOCAL_MODE', 'success', `Local AI enabled (${activeModel}). Processing on-device.`);
                    }
                } else if (isLocalModelReady) {
                    videoStore.recordEvent('LOCAL_MODE', 'success', `Local AI ready. Waiting for Edge transcript extraction.`);
                } else {
                    videoStore.recordEvent('CLOUD_MODE', 'info', `Routing to Cloud API for insight generation.`);
                }

                videoStore.recordEvent('PROCESSING', 'info', 'Extracting audio and generating transcript...');

                const dispatchToEdge = async (skipAiFlag: boolean) => {
                    return fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
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
                            skip_ai: skipAiFlag,
                        }),
                    });
                };

                let response = await dispatchToEdge(isLocalModelReady);
                if (!response.ok) return { success: false, errorMsg: `EDGE_HTTP_ERROR: ${response.status}`, videoId: videoUuid };

                let data = await response.json();
                if (!data.success) return { success: false, errorMsg: data.error ?? 'EDGE_PROCESSING_FAILED', videoId: videoUuid };

                // ─── LOCAL AI HANDOFF PHASE ─────────────────────────────────────
                if (data.is_local_handoff && activeModel) {
                    const rawText = data.transcript || clientTranscript || '';
                    const estimatedServerTokens = Math.ceil(rawText.length / 3.2) + 200;

                    if (estimatedServerTokens > localState.prefillTokens) {
                        videoStore.recordEvent('CLOUD_FALLBACK', 'warn', `Extracted transcript exceeds limit. Falling back to Cloud API...`);
                        await releaseNativeEngine();
                        response = await dispatchToEdge(false);
                        data = await response.json();
                        if (!data.success) return { success: false, errorMsg: data.error, videoId: videoUuid };
                        videoStore.recordEvent('SUCCESS', 'success', 'Cloud insights generated successfully!');
                        return { success: true, videoId: videoUuid };
                    }

                    videoStore.recordEvent('LOCAL_AI_START', 'info', `Starting Hardware Inference...`);

                    try {
                        const rawLocalOutput = await runLocalInference(rawText);

                        if (!rawLocalOutput || rawLocalOutput.length < 20) {
                            throw new Error("Local AI returned insufficient output.");
                        }

                        videoStore.recordEvent('LOCAL_AI_SUCCESS', 'success', 'Validating Schema...');

                        const parsedInsights = extractAndParseJSON(rawLocalOutput);

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

                        videoStore.recordEvent('SUCCESS', 'success', 'Insights generated successfully!');
                    } catch (localErr: any) {
                        videoStore.recordEvent('CLOUD_FALLBACK', 'warn', `Local AI failed: ${localErr.message}. Routing to Cloud API...`);
                        await releaseNativeEngine();

                        response = await dispatchToEdge(false);
                        data = await response.json();

                        if (!data.success) return { success: false, errorMsg: data.error, videoId: videoUuid };
                        videoStore.recordEvent('SUCCESS', 'success', 'Cloud insights generated successfully!');
                        return { success: true, videoId: videoUuid };
                    }
                } else {
                    videoStore.recordEvent('SUCCESS', 'success', 'Cloud insights generated successfully!');
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
            const rawMsg = result.errorMsg ?? 'Unknown error';
            console.log('[useProcessVideo] Pipeline failure:', rawMsg);

            if (result.videoId) {
                await supabase.from('videos').update({
                    status: 'failed',
                    error_message: rawMsg,
                    processing_completed_at: new Date().toISOString(),
                }).eq('id', result.videoId);
                queryClient.invalidateQueries({ queryKey: ['video-history'] });
            }
            setError(maskErrorMessage(rawMsg));
            if (clearActiveVideo) clearActiveVideo();
        },
    });
};