/**
 * @file services/pipeline.ts
 * @description Client-Side Pipeline Orchestrator (Cloud / Local AI Handoff)
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - DUAL ROUTING: Seamlessly handles Cloud Gemini execution OR Local Gemma-4 handoff.
 * - PROMPT DE-DUPLICATION: Stripped hardcoded prompts. Relies entirely on insights.ts.
 * - ZERO-UI-LOCK: Ensures local inference runs asynchronously without blocking.
 * - 100% REGRESSION FREE: Preserves chunking, batching, and retry algorithms.
 * ----------------------------------------------------------------------------
 */

import { supabase } from '../lib/supabase/client';
import { Database } from '../types/database/database.types';
import { parseVideoUrl } from '../utils/videoParser';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { runLocalInference } from './localInference';

type VideoInsert = Database['public']['Tables']['videos']['Insert'];
type VideoStatus = Database['public']['Enums']['video_status'];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export interface PipelineResult {
    success: boolean;
    videoId?: string;
    batchId?: string;
    error?: string;
}

interface EdgeResponse {
    success: boolean;
    error?: string;
    is_local_handoff?: boolean;
    transcript?: string;
    prompt?: string;
}

// ─── UTILITY: EXPONENTIAL BACKOFF RETRY ─────────────────────────────────────
async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    baseDelayMs: number = 1000,
): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: unknown) {
            attempt++;
            if (attempt >= maxRetries) throw error;
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[Pipeline:Retry] Operation failed. Retrying ${attempt}/${maxRetries}... ${msg}`);
            await new Promise((res) => setTimeout(res, baseDelayMs * Math.pow(2, attempt - 1)));
        }
    }
    throw new Error('Retry loop failed.');
}

// ─── UTILITY: ARRAY CHUNKING ────────────────────────────────────────────────
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

export class PipelineService {
    /**
     * Process a single video — Dynamically routes between Local SoC and Edge Cloud.
     */
    static async processSingleVideo(
        url: string,
        language: string = 'English',
        difficulty: string = 'standard',
        clientTranscript: string | null = null,
        forceSkipAi: boolean = false // Explicit UI Hook parameter
    ): Promise<PipelineResult> {
        try {
            const parsed = parseVideoUrl(url);
            if (!parsed.isValid || !parsed.normalizedUrl) {
                throw new Error('INVALID_MEDIA: URL format not recognized.');
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('UNAUTHORIZED: Valid session required.');

            // 1. Initialize DB Record
            const { data: videoRecord, error: dbError } = await supabase
                .from('videos')
                .insert({
                    user_id: session.user.id,
                    youtube_url: parsed.normalizedUrl,
                    youtube_video_id: parsed.videoId,
                    status: 'queued' as VideoStatus,
                    platform: parsed.platform,
                })
                .select('id')
                .single();

            if (dbError || !videoRecord) throw new Error(`DB_SYNC_ERROR: ${dbError?.message}`);

            // 2. Assess Routing Context
            const localState = useLocalAIStore.getState();
            const activeModel = localState.activeModelId;
            const isLocalReady = Boolean(activeModel && localState.downloadedModels.includes(activeModel));

            // The pipeline should skip Cloud AI if the UI explicitly requested it, OR if local models are active
            const shouldRunLocally = forceSkipAi || isLocalReady;

            // ─── FAST-PATH: NATIVE TRANSCRIPT + LOCAL AI ────────────────────────
            if (shouldRunLocally && clientTranscript) {
                console.log(`[Pipeline] Fast-Path: Routing native transcript directly to Local Hardware: ${activeModel}`);
                try {
                    await supabase.from('videos').update({ status: 'ai_processing' }).eq('id', videoRecord.id);

                    // ARCHITECTURE FIX: Pass ONLY the transcript. localInference.ts handles prompt injection via insights.ts
                    const rawLocalOutput = await runLocalInference(clientTranscript);

                    let parsedInsights: any;
                    try {
                        // Aggressive JSON extraction for local models
                        let sanitized = rawLocalOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                        if (!sanitized.startsWith('{')) {
                            const firstBrace = sanitized.indexOf('{');
                            const lastBrace = sanitized.lastIndexOf('}');
                            if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON boundaries found.");
                            sanitized = sanitized.substring(firstBrace, lastBrace + 1);
                        }
                        parsedInsights = JSON.parse(sanitized);
                    } catch (jsonErr) {
                        console.error("[Pipeline] JSON Parse Failure. Raw Output:", rawLocalOutput);
                        throw new Error("LITERT_SCHEMA_FAULT: The local model failed to output a strictly formatted JSON object.");
                    }

                    await supabase.from('ai_insights').insert({
                        video_id: videoRecord.id,
                        summary: parsedInsights.summary || "Summary generation failed.",
                        conclusion: parsedInsights.conclusion || null,
                        chapters: Array.isArray(parsedInsights.chapters) ? parsedInsights.chapters : [],
                        key_takeaways: Array.isArray(parsedInsights.key_takeaways) ? parsedInsights.key_takeaways : [],
                        seo_metadata: parsedInsights.seo_metadata || { tags: [], suggested_titles: [], description: '' },
                        ai_model: `Local: ${activeModel}`,
                        language,
                        processed_at: new Date().toISOString()
                    });

                    await supabase.from('videos').update({ status: 'completed', processing_completed_at: new Date().toISOString() }).eq('id', videoRecord.id);
                    return { success: true, videoId: videoRecord.id };
                } catch (localErr) {
                    console.warn('[Pipeline] Native Engine faulted on Fast-Path. Falling back to Edge Cloud.', localErr);
                    // Fall through to Edge function
                }
            }

            // ─── NORMAL PATH: EDGE FUNCTION (Cloud AI or Transcript Extraction) ───
            await withRetry(async () => {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        video_id: videoRecord.id,
                        video_url: parsed.normalizedUrl,
                        platform: parsed.platform,
                        language,
                        difficulty,
                        transcript_text: clientTranscript,
                        skip_ai: shouldRunLocally // Tell Edge to abort Cloud Gemini and just return the transcript
                    }),
                });

                if (!response.ok) throw new Error(`EDGE_GATEWAY_ERROR: HTTP ${response.status}`);

                const data = (await response.json()) as EdgeResponse;
                if (!data.success) throw new Error(`EDGE_EXECUTION_ERROR: ${data.error ?? 'Unknown'}`);

                // ─── EDGE HANDOFF PATH: LOCAL EXECUTION ──────────────────────────
                if (data.is_local_handoff && activeModel) {
                    console.log(`[Pipeline] Edge Handoff: Executing prompt locally...`);

                    const transcriptPayload = data.transcript || clientTranscript;
                    if (!transcriptPayload) throw new Error("LOCAL_HANDOFF_FAULT: Edge failed to return transcript.");

                    await supabase.from('videos').update({ status: 'ai_processing' }).eq('id', videoRecord.id);

                    // ARCHITECTURE FIX: Pass ONLY the transcript.
                    const rawLocalOutput = await runLocalInference(transcriptPayload);

                    let parsedInsights: any;
                    try {
                        let sanitized = rawLocalOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                        if (!sanitized.startsWith('{')) {
                            const firstBrace = sanitized.indexOf('{');
                            const lastBrace = sanitized.lastIndexOf('}');
                            if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON boundaries found.");
                            sanitized = sanitized.substring(firstBrace, lastBrace + 1);
                        }
                        parsedInsights = JSON.parse(sanitized);
                    } catch (jsonErr) {
                        throw new Error("LITERT_SCHEMA_FAULT: The local model failed to output a strictly formatted JSON object.");
                    }

                    await supabase.from('ai_insights').insert({
                        video_id: videoRecord.id,
                        summary: parsedInsights.summary || "Summary generation failed.",
                        conclusion: parsedInsights.conclusion || null,
                        chapters: Array.isArray(parsedInsights.chapters) ? parsedInsights.chapters : [],
                        key_takeaways: Array.isArray(parsedInsights.key_takeaways) ? parsedInsights.key_takeaways : [],
                        seo_metadata: parsedInsights.seo_metadata || { tags: [], suggested_titles: [], description: '' },
                        ai_model: `Local: ${activeModel}`,
                        language,
                        processed_at: new Date().toISOString()
                    });

                    await supabase.from('videos').update({ status: 'completed', processing_completed_at: new Date().toISOString() }).eq('id', videoRecord.id);
                }

            });

            return { success: true, videoId: videoRecord.id };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[PipelineService:Single] Critical Failure:', msg);
            return { success: false, error: msg };
        }
    }

    /**
     * Batch job orchestrator — Restored without regression.
     */
    static async submitBatch(urls: string[], batchName: string): Promise<PipelineResult> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('UNAUTHORIZED: Session expired.');

            const validVideos = urls
                .map(url => parseVideoUrl(url))
                .filter(p => p.isValid && p.normalizedUrl);

            if (validVideos.length === 0) throw new Error('VALIDATION_FAILED: No valid URLs.');

            const { data: batch, error: batchError } = await supabase
                .from('batch_jobs')
                .insert({
                    user_id: session.user.id,
                    name: batchName,
                    status: 'processing',
                    total_videos: validVideos.length,
                    completed_videos: 0,
                    failed_videos: 0,
                })
                .select('id')
                .single();

            if (batchError || !batch) throw new Error(`BATCH_INIT_FAILED: ${batchError?.message}`);

            const videoInserts: VideoInsert[] = validVideos.map((parsed) => ({
                user_id: session.user.id,
                batch_job_id: batch.id,
                youtube_url: parsed.normalizedUrl!,
                youtube_video_id: parsed.videoId,
                status: 'queued' as VideoStatus,
                platform: parsed.platform,
            }));

            const chunks = chunkArray(videoInserts, 50);
            for (const chunk of chunks) {
                const { error: chunkError } = await supabase.from('videos').insert(chunk);
                if (chunkError) throw new Error(`CHUNK_INSERT_FAILED: ${chunkError.message}`);
            }

            return { success: true, batchId: batch.id };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }

    static async killProcess(videoId: string): Promise<boolean> {
        try {
            const { error } = await supabase.from('videos').delete().eq('id', videoId);
            if (error) throw error;
            return true;
        } catch (err: unknown) {
            return false;
        }
    }
}