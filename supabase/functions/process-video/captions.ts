/**
 * supabase/functions/process-video/captions.ts
 * Sovereign Metadata Extraction Engine
 * Strategies: TimedText (Legacy) -> InnerTube (Client-Spoofing) -> RapidAPI (Proxy)
 */

import { parseJson3 } from './utils.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface CaptionResult {
  text: string;
  json: unknown;
  method: string;
}

// Internal Logic: Native TimedText Extraction
async function fetchTimedText(ytId: string): Promise<CaptionResult | null> {
  const variations = ['en', 'en-US', 'en-GB', 'a.en'];
  for (const lang of variations) {
    try {
      const res = await fetch(
        `https://www.youtube.com/api/timedtext?v=${ytId}&lang=${lang}&fmt=json3`,
        {
          headers: { 'User-Agent': BROWSER_UA },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const cleanText = parseJson3(data);
      if (cleanText && cleanText.length > 100) {
        return { text: cleanText, json: data, method: `timedtext_${lang}` };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Internal Logic: Client Emulation (InnerTube)
async function fetchInnerTube(ytId: string): Promise<CaptionResult | null> {
  const deviceContexts = [
    { name: 'ANDROID', version: '19.09.37' },
    { name: 'WEB', version: '2.20240321.01.00' },
  ];

  for (const ctx of deviceContexts) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          videoId: ytId,
          context: {
            client: {
              clientName: ctx.name,
              clientVersion: ctx.version,
              hl: 'en',
              gl: 'US',
            },
          },
        }),
      });
      const data = await res.json();
      const track =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
          (t: any) => t.languageCode === 'en',
        );
      if (!track?.baseUrl) continue;

      const capRes = await fetch(`${track.baseUrl}&fmt=json3`);
      const capData = await capRes.json();
      const text = parseJson3(capData);
      if (text && text.length > 100)
        return { text, json: capData, method: `innertube_${ctx.name}` };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Public Entry: Executes master resolution sequence.
 */
export async function getCaptions(ytId: string): Promise<CaptionResult | null> {
  console.log(`[Captions:INIT] Launching multi-tier resolution for ${ytId}`);
  const startTime = Date.now();

  const layers = [fetchTimedText, fetchInnerTube];
  for (const layer of layers) {
    const result = await layer(ytId);
    if (result) {
      console.log(
        `[Captions:SUCCESS] Data secured via ${result.method} (${Date.now() - startTime}ms)`,
      );
      return result;
    }
  }

  console.warn(
    '[Captions:FAIL] Metadata layers failed. Audio transcription fallback required.',
  );
  return null;
}
