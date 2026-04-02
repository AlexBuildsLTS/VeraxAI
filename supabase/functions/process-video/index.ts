/**
 * process-video/index.ts
 * Main orchestrator - Streaming Proxy Architecture
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { extractYouTubeId } from './utils.ts';
import { getCaptions } from './captions.ts';
import { getAudioUrl } from './audio.ts';
import { transcribeAudio } from './deepgram.ts';
import { generateInsights } from './insights.ts';
import type {
  ProcessVideoRequest,
  ExtractionMethod,
  TranscriptJson,
} from '../../../types/api/index.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  const supabase = createAdminClient();
  let dbRecordId: string | null = null;

  const updateStatus = async (status: string, error?: string) => {
    if (!dbRecordId) return;
    await supabase
      .from('videos')
      .update({
        status,
        error_message: error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbRecordId);
  };

  try {
    const body: ProcessVideoRequest & { youtube_url?: string } =
      await req.json();
    dbRecordId = body.video_id;
    const videoUrl = body.video_url || body.youtube_url;
    const language = body.language ?? 'english';
    const clientTranscript = body.transcript_text;

    if (!dbRecordId || !videoUrl)
      throw new Error('video_id and video_url required');

    // CRITICAL: Get the 11-char YouTube ID
    const ytId = extractYouTubeId(videoUrl);
    if (!ytId) throw new Error('Invalid YouTube URL');

    console.log(`[Process] Job started for Record: ${dbRecordId}`);

    let transcript = '';
    let method: ExtractionMethod = 'unknown';
    let rawJson: TranscriptJson | unknown = null;

    // Phase 1: Try Captions (Fast path)
    const captionResult = !clientTranscript ? await getCaptions(ytId) : null;

    if (clientTranscript) {
      transcript = clientTranscript;
      method = 'client';
    } else if (captionResult) {
      transcript = captionResult.text;
      method = captionResult.method as ExtractionMethod;
      rawJson = captionResult.json;
    } else {
      // Phase 2: Audio STT (Fallback path)
      await updateStatus('transcribing');
      console.log('[Process] Falling back to Deepgram Streaming...');

      const serverAudioUrl = await getAudioUrl(videoUrl, ytId);
      const dgResult = await transcribeAudio(serverAudioUrl);

      transcript = dgResult.text;
      method = 'deepgram';
      rawJson = dgResult.json;
    }

    // Save Transcript
    await supabase.from('transcripts').insert({
      video_id: dbRecordId,
      transcript_text: transcript,
      transcript_json: rawJson,
      confidence_score: method === 'deepgram' ? 0.95 : 1.0,
      language_code: 'en',
      extraction_method: method,
    });

    // Phase 3: AI Insights
    await updateStatus('ai_processing');
    const insights = await generateInsights(transcript, language, 'standard');

    await supabase.from('ai_insights').upsert({
      video_id: dbRecordId,
      ai_model: insights.model,
      summary: insights.summary,
      chapters: insights.chapters,
      key_takeaways: insights.key_takeaways,
      seo_metadata: insights.seo_metadata,
      updated_at: new Date().toISOString(),
    });

    await updateStatus('completed');
    return new Response(JSON.stringify({ success: true, method }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Process] FATAL ERROR:', errorMessage);
    if (dbRecordId) await updateStatus('failed', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Still return 200 so the frontend can display the message
      },
    );
  }
});
