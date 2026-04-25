/**
 * supabase/functions/process-video/deepgram.ts
 * Universal Deepgram Relay Engine - Enterprise Tier
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. SUPABASE SECRETS: Securely pulls DEEPGRAM_API_KEY from Deno environment.
 * 2. ABORT SIGNALS: Prevents Edge Function 504 timeouts if Deepgram hangs.
 * 3. DUAL-MODALITY: Handles both direct URLs and raw ArrayBuffers effortlessly.
 */

export interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DeepgramResult {
  text: string;
  json: DeepgramResponse;
}

// Shared Response Handler
async function processDeepgramResponse(response: Response): Promise<DeepgramResult> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TRANSCRIPTION_REJECTED_${response.status}: ${errorText}`);
  }

  const payload: DeepgramResponse = await response.json();
  const extractedText = payload.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('TRANSCRIPTION_EMPTY_RESULT: Deepgram returned no spoken text.');
  }

  return {
    text: extractedText,
    json: payload
  };
}

// METHOD A: For direct URL processing (Vimeo, Patreon, Raw Audio, etc.)
export async function transcribeUrl(mediaUrl: string): Promise<DeepgramResult> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY_MISSING');

  console.log(`[Deepgram] Routing universal URL directly to Nova-2 API...`);

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: mediaUrl }),
    signal: AbortSignal.timeout(45000), // 45-second abort shield
  });

  return processDeepgramResponse(response);
}

// METHOD B: For Buffer processing (Bypasses IP blocks by streaming from Edge)
export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<DeepgramResult> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY_MISSING');

  console.log(`[Deepgram] Uploading ${audioBuffer.byteLength} bytes to Nova-2 API...`);

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/octet-stream',
    },
    body: audioBuffer,
    signal: AbortSignal.timeout(60000), // 60-second abort shield for large buffer uploads
  });

  return processDeepgramResponse(response);
}
