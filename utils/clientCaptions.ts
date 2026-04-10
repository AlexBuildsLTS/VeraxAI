/**
 * utils/clientCaptions.ts
 * Client-Side YouTube Caption Extractor (Ultra-Fast Failover)
 * ----------------------------------------------------------------------------
 * STRATEGY:
 * 1. Direct fetch: React Native has no CORS. This works instantly on mobile (Free).
 * 2. Instant Failover: If on Web (CORS blocked), instantly route to Edge Node (RapidAPI).
 * WE DO NOT WASTE TIME ON DEAD FREE PROXIES.
 */

interface TimedTextSegment {
  utf8?: string;
}

interface TimedTextEvent {
  segs?: TimedTextSegment[];
}

interface TimedTextResponse {
  events?: TimedTextEvent[];
}

const LANGUAGE_CODES = ['en', 'a.en', 'en-US', 'en-GB'];

function buildTimedTextUrl(videoId: string, lang: string): string {
  return `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
}

async function parseTimedTextResponse(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`HTTP_${response.status}`);

  const data = (await response.json()) as TimedTextResponse;
  if (!data?.events || !Array.isArray(data.events)) throw new Error('NO_EVENTS');

  const text = data.events
    .filter((e): e is TimedTextEvent & { segs: TimedTextSegment[] } => Array.isArray(e.segs))
    .map(e => e.segs.map(s => s.utf8 ?? '').join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\\n/g, ' ')
    .trim();

  if (text.length < 50) throw new Error('TOO_SHORT');
  return text;
}

export async function fetchClientCaptions(
  videoId: string,
  platform: string = 'youtube',
): Promise<string | null> {
  if (!videoId || platform !== 'youtube') return null;

  console.log(`[Captions:Client] Attempting mobile fast-path for ${videoId}...`);

  try {
    const controller = new AbortController();
    // Strict 3-second timeout. We fail fast to let the Edge Node take over.
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const transcript = await Promise.any(
      LANGUAGE_CODES.map(lang =>
        fetch(buildTimedTextUrl(videoId, lang), { signal: controller.signal })
          .then(parseTimedTextResponse),
      ),
    );

    clearTimeout(timeoutId);
    console.log(`[Captions:Client] ✓ Direct fetch success. Words: ${transcript.split(/\s+/).length}`);
    return transcript;

  } catch {
    // We hit CORS (Web Browser) or a timeout. 
    // Do NOT loop through garbage proxies. Instantly hand off to the Edge backend. 
    console.log('[Captions:Client] Direct fetch blocked (CORS/Web). Instantly routing to Verbum Edge...');
  }
  return null; // Signal to use Edge Node fallback
}