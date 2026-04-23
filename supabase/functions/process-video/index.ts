/**
 * supabase/functions/process-video/index.ts
 * Master Pipeline Orchestrator
 * ----------------------------------------------------------------------------
 * TIER PIPELINE:
 * 1. Client-provided transcript (fast path)
 * 2. Server-side native caption scraper (Forced execution on YouTube URLs)
 * 3. Audio Resolver -> Deepgram transcription
 * 4. AI insights (Gemini 3.1 Flash-Lite with BYOK Support)
 * 5. Finalization & JSON Metadata Telemetry (Chart tracking per key)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { getCaptions } from './captions.ts';
import { getAudioUrl } from './audio.ts';
import { transcribeAudio } from './deepgram.ts';
import { generateInsights } from './insights.ts';
import { extractYouTubeId, diffMs, sanitizeForDb, estimateReadingTime } from './utils.ts';
import { Database } from '../../../types/database/database.types.ts';

type VideoStatus = Database['public']['Enums']['video_status'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 });

  const supabase = createAdminClient();
  const pipelineStartTime = Date.now();
  let persistentJobId: string | null = null;
  let activePhase = 'handshake';
  let invokingUserId: string | null = null;

  const broadcastStatus = async (status: VideoStatus, telemetry?: { error?: string }) => {
    if (!persistentJobId) return;
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = { status, updated_at: now };
    if (telemetry?.error) payload.error_message = telemetry.error;
    if (status === 'completed' || status === 'failed') {
      payload.processing_completed_at = now;
      payload.processing_duration_ms = diffMs(pipelineStartTime);
    }

    await supabase.from('videos').update(payload).eq('id', persistentJobId);
  };

  try {
    activePhase = 'payload_validation';
    const body = await req.json() as Record<string, unknown>;
    persistentJobId = body.video_id as string;

    const video_url = body.video_url as string;
    const language = (body.language as string) || 'English';
    const difficulty = (body.difficulty as string) || 'standard';

    if (!persistentJobId || !video_url) throw new Error('MISSING_MANDATORY_PAYLOAD');

    console.log(`[Pipeline] Starting job ${persistentJobId}`);
    await broadcastStatus('downloading');

    // ── TIER 0: FETCH INVOKING USER & BYOK CREDENTIALS ───────────────────────
    activePhase = 'identity_resolution';
    let customGeminiKey: string | undefined = undefined;

    const { data: videoData } = await supabase.from('videos').select('user_id').eq('id', persistentJobId).single();
    if (videoData?.user_id) {
      invokingUserId = videoData.user_id;
      const { data: profile } = await supabase.from('profiles').select('role, custom_api_key').eq('id', invokingUserId).single();

      // Strict RBAC: Only parse keys if user is Premium or Admin
      if (profile && (profile.role === 'premium' || profile.role === 'admin') && profile.custom_api_key) {
        try {
          const parsedKeys = JSON.parse(profile.custom_api_key);
          if (parsedKeys.gemini) {
            customGeminiKey = parsedKeys.gemini;
            console.log(`[Pipeline] Premium BYOK Gemini key detected for user ${invokingUserId}`);
          }
        } catch (e) {
          console.warn('[Pipeline] Failed to parse custom API keys JSON.', e);
        }
      }
    }

    let finalTranscript = (body.transcript_text as string) ?? '';
    let rawMetadata: Record<string, unknown> = {};
    let extractionMethod = finalTranscript.length >= 100 ? 'client_fast_path' : 'unknown';

    const mediaId = extractYouTubeId(video_url);

    // ── TIER 1: SERVER-SIDE NATIVE CAPTION SCRAPER ───────────────────────────
    if (finalTranscript.length < 100 && mediaId) {
      activePhase = 'scraping_engine';
      const scrapeResult = await getCaptions(mediaId);
      if (scrapeResult && scrapeResult.text.length > 100) {
        finalTranscript = sanitizeForDb(scrapeResult.text);
        rawMetadata = (scrapeResult.json as Record<string, unknown>) ?? {};
        extractionMethod = scrapeResult.method;
        console.log(`[Tier 1] ✓ Scraped ${finalTranscript.split(/\s+/).length} words. Bypassing Deepgram.`);
      } else {
        console.log(`[Tier 1] Scraper returned insufficient data. Escalating to Audio Engine.`);
      }
    }

    // ── TIER 2: AUDIO EXTRACTION + DEEPGRAM ──────────────────────────────────
    if (finalTranscript.length < 100) {
      activePhase = 'audio_engine';
      await broadcastStatus('transcribing');

      try {
        const audioUrl = await getAudioUrl(video_url);

        console.log('[Tier 2] Streaming media to buffer...');
        const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(45000) });
        if (!audioResponse.ok) throw new Error(`STREAM_REJECTED: HTTP ${audioResponse.status}`);

        const buffer = await audioResponse.arrayBuffer();
        if (buffer.byteLength < 5000) throw new Error(`STREAM_CORRUPT: Buffer too small.`);

        const transcription = await transcribeAudio(buffer);

        finalTranscript = sanitizeForDb(transcription.text);
        rawMetadata = transcription.json;
        extractionMethod = 'deepgram_nova_2';
      } catch (err: unknown) {
        throw new Error(`TRANSCRIPTION_FAILED: ${(err as Error).message}`);
      }
    }

    if (!finalTranscript || finalTranscript.trim().length < 50) {
      throw new Error('EXTRACTION_FAILED: Transcript is empty.');
    }

    // ── TIER 3: PERSIST TRANSCRIPT ────────────────────────────────────────────
    activePhase = 'db_persistence';
    const wordCount = finalTranscript.split(/\s+/).length;

    const { error: transcriptError } = await supabase.from('transcripts').insert({
      video_id: persistentJobId,
      transcript_text: finalTranscript,
      transcript_json: Object.keys(rawMetadata).length > 0 ? rawMetadata : null,
      extraction_method: extractionMethod,
      language_code: language.toLowerCase().substring(0, 2),
      word_count: wordCount,
      reading_time_minutes: estimateReadingTime(wordCount),
    });

    if (transcriptError) throw new Error(`DB_FAIL: ${transcriptError.message}`);

    // ── TIER 4: AI INSIGHTS ───────────────────────────────────────────────────
    activePhase = 'intelligence_engine';
    await broadcastStatus('ai_processing');

    // Passes the extracted custom key directly to the insights generation engine
    const insights = await generateInsights(finalTranscript, language, difficulty, customGeminiKey);

    const { error: insightError } = await supabase.from('ai_insights').upsert({
      video_id: persistentJobId,
      summary: insights.summary,
      conclusion: insights.conclusion,
      chapters: insights.chapters as any,
      key_takeaways: insights.key_takeaways as any,
      seo_metadata: insights.seo_metadata as any,
      language,
      ai_model: insights.model,
      tokens_used: insights.tokens_used,
      processed_at: new Date().toISOString(),
    });

    if (insightError) throw new Error(`INSIGHT_DB_FAIL: ${insightError.message}`);

    // ── TIER 5: UI CHART TELEMETRY ────────────────────────────────────────────
    activePhase = 'chart_telemetry';
    if (invokingUserId) {
      await supabase.from('usage_logs').insert({
        user_id: invokingUserId,
        video_id: persistentJobId,
        action: 'ai_insights_generated',
        ai_model: insights.model,
        tokens_consumed: insights.tokens_used,
        duration_seconds: Math.floor(diffMs(pipelineStartTime) / 1000),
        metadata: { api_key_name: insights.used_key_alias }
      });
    }

    // ── TIER 6: FINALIZE ──────────────────────────────────────────────────────
    await broadcastStatus('completed');
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline:FAIL] [${activePhase}]: ${errorMsg}`);
    await broadcastStatus('failed', { error: errorMsg });
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});