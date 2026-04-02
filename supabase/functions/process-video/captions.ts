/**
 * process-video/captions.ts
 * Multi-method Backend Caption Extraction.
 * Strategy: TimedText -> Innertube (Multi-Client) -> RapidAPI (Multiple Hosts)
 */

import { stripVtt as _stripVtt, parseJson3 } from './utils.ts';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface CaptionResult {
  text: string;
  json: unknown;
  method: string;
}

// ── Method 1: TimedText ───────────────────────────────────────────────────────

async function tryTimedtext(ytId: string): Promise<CaptionResult | null> {
  for (const lang of ['en', 'en-US', 'en-GB', 'a.en']) {
    try {
      const res = await fetch(
        `https://www.youtube.com/api/timedtext?v=${ytId}&lang=${lang}&fmt=json3`,
        {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = parseJson3(data);
      if (text && text.length > 50)
        return { text, json: data, method: `timedtext_${lang}` };
    } catch {
      continue;
    }
  }
  return null;
}

// ── Method 2: Innertube (Multi-Client) ────────────────────────────────────────

async function tryInnertube(ytId: string): Promise<CaptionResult | null> {
  const clients = [
    { name: 'ANDROID', version: '19.09.37' },
    { name: 'WEB', version: '2.20240321.01.00' },
    { name: 'IOS', version: '19.09.3' },
  ];

  for (const client of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          videoId: ytId,
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              hl: 'en',
              gl: 'US',
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const track =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
          (t: { languageCode: string; baseUrl: string }) =>
            t.languageCode === 'en',
        );

      if (!track?.baseUrl) continue;

      const capRes = await fetch(`${track.baseUrl}&fmt=json3`);
      const capData = await capRes.json();
      const text = parseJson3(capData);
      if (text && text.length > 50)
        return { text, json: capData, method: `innertube_${client.name}` };
    } catch {
      continue;
    }
  }
  return null;
}

// ── Method 3: RapidAPI (Multi-Provider) ───────────────────────────────────────

async function tryRapidAPI(ytId: string): Promise<CaptionResult | null> {
  const key = Deno.env.get('RAPIDAPI_KEY');
  if (!key) return null;

  const providers = [
    {
      host: 'youtube-transcriptor.p.rapidapi.com',
      path: `/transcript?video_id=${ytId}&lang=en`,
    },
    { host: 'yt-api.p.rapidapi.com', path: `/dl?id=${ytId}` },
  ];

  for (const { host, path } of providers) {
    try {
      console.log(`[Captions] Calling RapidAPI: ${host}`);
      const res = await fetch(`https://${host}${path}`, {
        headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      let text = '';

      if (Array.isArray(data)) {
        text = data.map((item: { text?: string }) => item.text ?? '').join(' ');
      } else if (data && (data.continuationContents || data.actions)) {
        text = parseJson3(data) ?? '';
      }

      if (text && text.length > 50)
        return { text, json: data, method: `rapidapi_${host}` };
    } catch {
      continue;
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCaptions(ytId: string): Promise<CaptionResult | null> {
  console.log(`[Captions] 🚀 Starting master resolution for ${ytId}`);
  const startTime = Date.now();

  const result =
    (await tryTimedtext(ytId)) ||
    (await tryInnertube(ytId)) ||
    (await tryRapidAPI(ytId));

  if (result) {
    console.log(
      `[Captions] ✓ SUCCESS via ${result.method} in ${Date.now() - startTime}ms`,
    );
    return result;
  }

  console.error(`[Captions] ❌ ALL BACKEND METHODS FAILED`);
  return null;
}
