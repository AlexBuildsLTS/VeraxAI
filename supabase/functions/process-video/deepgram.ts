/**
 * process-video/deepgram.ts
 * Deepgram Nova-2 STT - BINARY STREAMING PROXY VERSION
 */

const DEEPGRAM_URL =
  'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=true&detect_language=true';

interface DeepgramResult {
  text: string;
  json: unknown;
  method: string;
}

/**
 * Transcribes audio by streaming the bits through the server.
 * This prevents Deepgram from being blocked by YouTube's IP filters.
 */
export async function transcribeAudio(
  audioUrl: string,
  _options?: { throwOnEmptyTranscript?: boolean },
): Promise<DeepgramResult> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is missing.');

  console.log(`[Deepgram] 1. Fetching audio stream...`);

  // Step 1: The Edge Function fetches the audio (Bypasses Deepgram's fetch limit)
  const audioRes = await fetch(audioUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!audioRes.ok || !audioRes.body) {
    throw new Error(
      `Audio source returned HTTP ${audioRes.status}. The link is likely expired.`,
    );
  }

  console.log(`[Deepgram] 2. Piping binary stream to Deepgram...`);

  // Step 2: Stream the body directly to Deepgram
  const res = await fetch(DEEPGRAM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type':
        audioRes.headers.get('content-type') || 'application/octet-stream',
    },
    body: audioRes.body, // DIRECT BINARY PIPE
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[Deepgram] 400/Fetch Error: ${errorBody}`);
    throw new Error(`Deepgram API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

  if (!text || text.length < 5) {
    throw new Error('Deepgram returned an empty transcript.');
  }

  console.log(`[Deepgram] ✓ Success: ${text.length} chars.`);

  return {
    text: text.trim(),
    json: data,
    method: 'deepgram',
  };
}
