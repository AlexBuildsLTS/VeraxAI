/**
 * supabase/functions/process-video/deepgram.ts
 * Professional Transcription Service (Deepgram Nova-2)
 * Features: Smart Formatting, Diarization, Detailed Log Tracing
 */

export interface DeepgramResult {
  text: string;
  json: Record<string, any>;
}

export async function transcribeAudio(audioUrl: string): Promise<DeepgramResult> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY_MISSING: Secure secrets must be configured in Supabase.');
  }

  console.log('[Deepgram:CONNECT] Dispatching audio stream to Nova-2 model...');

  try {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    if (!response.ok) {
      const errorContext = await response.text();
      console.error(`[Deepgram:ERROR] Node rejected payload. Status: ${response.status}. Context: ${errorContext}`);
      throw new Error(`TRANSCRIPTION_REJECTED_${response.status}`);
    }

    const payload = await response.json();
    const extractedText = payload.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!extractedText || extractedText.trim() === '') {
      console.error('[Deepgram:ERROR] API returned successfully but payload text was null.');
      throw new Error('TRANSCRIPTION_EMPTY_RESULT');
    }

    console.log(`[Deepgram:SUCCESS] Extraction finalized. Word count: ${extractedText.split(' ').length}`);
    return { text: extractedText, json: payload };

  } catch (err: any) {
    console.error(`[Deepgram:FATAL] Network or Logic failure: ${err.message}`);
    throw err;
  }
}