/**
 * utils/youtubeCaptions.ts
 * Professional Client-side YouTube caption fetcher.
 * Uses a rotating proxy system and robust parsing to bypass bot blocks.
 */

const PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/',
  
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJson3Events(data: any): string | null {
  if (!data?.events?.length) return null;
  const text = data.events
    .filter((e: any) => e.segs)
    .flatMap((e: any) =>
      e.segs.map((s: any) => (s.utf8 ?? '').replace(/\n/g, ' ')),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 50 ? text : null;
}

async function proxyFetch(
  targetUrl: string,
  timeoutMs = 10000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  for (const proxy of PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(targetUrl)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        clearTimeout(timeout);
        return res;
      }
    } catch (_) {
      continue;
    }
  }
  clearTimeout(timeout);
  return null;
}

// ── Method 1: timedtext JSON REST API ─────────────────────────────────────────

async function tryTimedtext(videoId: string): Promise<string | null> {
  for (const lang of ['en', 'en-US', 'en-GB', 'a.en']) {
    try {
      const res = await proxyFetch(
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
      );
      if (!res) continue;
      const data = await res.json();
      const text = parseJson3Events(data);
      if (text) {
        console.log(
          `[Captions] timedtext(${lang}) success: ${text.length} chars`,
        );
        return text;
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

// ── Method 2: Watch Page Scrape ───────────────────────────────────────────────

async function tryWatchPage(videoId: string): Promise<string | null> {
  try {
    const res = await proxyFetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      15000,
    );
    if (!res) return null;

    const html = await res.text();
    if (html.length < 10000) return null; // Bot block

    const marker = 'ytInitialPlayerResponse = {';
    const markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return null;

    const jsonStart = html.indexOf('{', markerIdx);
    let depth = 0,
      i = jsonStart;
    for (; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    const player = JSON.parse(html.substring(jsonStart, i + 1));
    const tracks =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    const track =
      tracks.find((t: any) => t.languageCode === 'en' && !t.kind) ||
      tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
      tracks[0];

    if (!track?.baseUrl) return null;

    const captionUrl = `${track.baseUrl}&fmt=json3`.replace(/\\u0026/g, '&');
    const capRes = await proxyFetch(captionUrl);
    if (!capRes) return null;

    const text = parseJson3Events(await capRes.json());
    if (text) {
      console.log(`[Captions] Watch page SUCCESS: ${text.length} chars`);
      return text;
    }
  } catch (err) {
    console.warn('[Captions] Watch page fallback failed');
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchYouTubeCaptions(
  videoId: string,
): Promise<string | null> {
  console.log('[Captions] Initiating client extraction for:', videoId);

  const m1 = await tryTimedtext(videoId);
  if (m1) return m1;

  const m2 = await tryWatchPage(videoId);
  if (m2) return m2;

  console.warn('[Captions] All client-side proxies exhausted.');
  return null;
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|m\/watch\?v=))([\w-]{11})/,
  );
  return match ? match[1] : null;
}
