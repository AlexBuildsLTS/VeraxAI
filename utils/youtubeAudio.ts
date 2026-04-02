/**
 * utils/youtubeAudio.ts
 * Client-side audio URL resolution with rotating proxies and robust API fallbacks.
 * Extracts direct audio streams from YouTube and other supported platforms.
 */

import { detectPlatform, type VideoPlatform } from './youtube';


const PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.tokhmi.xyz',
] as const;

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://iv.ggtyler.dev',
  'https://inv.tux.pizza',
] as const;

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://co.wuk.sh',
] as const;

interface AudioStream {
  url?: string;
  mimeType?: string;
  type?: string;
  bitrate?: number;
  quality?: string;
}

interface AudioResult {
  url: string;
  method: string;
  platform: VideoPlatform;
}

/**
 * Executes a fetch request through a rotating list of CORS proxies.
 */

async function proxyFetch(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  for (const proxy of PROXIES) {
    try {
      const proxiedUrl = `${proxy}${encodeURIComponent(url)}`;
      const res = await fetch(proxiedUrl, {
        ...options,
        signal: controller.signal,
      });
      if (res.ok) {
        clearTimeout(timeout);
        return res;
      }
    } catch {
      continue;
    }
  }
  clearTimeout(timeout);
  return null;
}

/**
 * Executes a direct fetch request with timeout capabilities.
 */
async function directFetch(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok ? res : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Attempts audio extraction via RapidAPI providers.
 * Corrected variable naming to prevent ReferenceErrors and added robust JSON parsing.
 */
async function tryRapidAPI(ytId: string): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) {
    console.log(
      '[Audio] RapidAPI key not configured in frontend .env, skipping',
    );
    return null;
  }

  const providers = [
    { host: 'youtube-mp36.p.rapidapi.com', path: `/dl?id=${ytId}` },
    { host: 'yt-api.p.rapidapi.com', path: `/dl?id=${ytId}` },
  ];

  for (const { host, path } of providers) {
    try {
      console.log(`[Audio] Trying RapidAPI (${host})...`);
      const res = await directFetch(
        `https://${host}${path}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': host,
          },
        },
        15000,
      );

      if (!res) continue;

      const data = await res.json();

      const audioUrl =
        data.link ||
        data.url ||
        data.download ||
        data.dlink ||
        data.data?.downloadUrl ||
        data.audio?.[0]?.url ||
        data.result?.url ||
        data.file;

      if (
        audioUrl &&
        typeof audioUrl === 'string' &&
        audioUrl.startsWith('http')
      ) {
        return audioUrl;
      }
    } catch (e) {
      console.log(`[Audio] RapidAPI ${host} error:`, e);
    }
  }
  return null;
}

/**
 * Attempts audio extraction via public Piped API instances.
 */
async function tryPiped(ytId: string): Promise<string | null> {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await proxyFetch(`${base}/streams/${ytId}`, {}, 8000);
      if (!res) continue;

      const data = await res.json();
      const streams: AudioStream[] = data.audioStreams ?? [];

      const stream = streams
        .filter(
          (s) =>
            s.url &&
            (s.mimeType?.includes('audio/mp4') ||
              s.mimeType?.includes('audio/webm')),
        )
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

      if (stream?.url) return stream.url;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Attempts audio extraction via public Invidious API instances.
 */
async function tryInvidious(ytId: string): Promise<string | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await proxyFetch(
        `${base}/api/v1/videos/${ytId}?fields=adaptiveFormats`,
        {},
        8000,
      );
      if (!res) continue;

      const data = await res.json();
      const formats: AudioStream[] = data.adaptiveFormats ?? [];

      const stream = formats
        .filter((f) => f.url && f.type?.includes('audio'))
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

      if (stream?.url) return stream.url;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Attempts audio extraction via public Cobalt API instances.
 */
async function tryCobalt(videoUrl: string): Promise<string | null> {
  for (const base of COBALT_INSTANCES) {
    try {
      const res = await directFetch(
        `${base}/api/json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            url: videoUrl,
            aFormat: 'mp3',
            isAudioOnly: true,
            filenamePattern: 'basic',
          }),
        },
        20000,
      );

      if (!res) continue;

      const data = await res.json();

      if (data.status === 'stream' && data.url) return data.url;
      if (data.status === 'redirect' && data.url) return data.url;
      if (data.audio) return data.audio;
    } catch (e) {
      continue;
    }
  }
  return null;
}

/**
 * Attempts audio extraction specifically for Vimeo URLs.
 */
async function tryVimeo(vimeoId: string): Promise<string | null> {
  try {
    const res = await proxyFetch(
      `https://vimeo.com/api/v2/video/${vimeoId}.json`,
      {},
      10000,
    );
    if (!res) return null;

    const data = await res.json();
    if (data[0]?.url) {
      return tryCobalt(`https://vimeo.com/${vimeoId}`);
    }
  } catch {
    // Fall through
  }
  return tryCobalt(`https://vimeo.com/${vimeoId}`);
}

/**
 * Orchestrates audio URL resolution by attempting sequential extraction methods.
 * Unified naming convention used throughout.
 */
export async function fetchYouTubeAudioUrl(
  videoUrl: string,
  videoId?: string,
): Promise<string | null> {
  const platform = detectPlatform(videoUrl);

  if (platform === 'direct') return videoUrl;

  if (platform === 'youtube') {
    const ytId = videoId || extractYouTubeIdFromUrl(videoUrl);
    if (ytId) {
      const rapidApi = await tryRapidAPI(ytId);
      if (rapidApi) return rapidApi;

      const piped = await tryPiped(ytId);
      if (piped) return piped;

      const invidious = await tryInvidious(ytId);
      if (invidious) return invidious;
    }
  }

  if (platform === 'vimeo' && videoId) {
    const vimeo = await tryVimeo(videoId);
    if (vimeo) return vimeo;
  }

  const cobalt = await tryCobalt(videoUrl);
  if (cobalt) return cobalt;

  return null;
}

function extractYouTubeIdFromUrl(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/|m\/watch\?v=))([\w-]{11})/i,
  );
  return match?.[1] ?? null;
}

export async function fetchAudioWithMetadata(
  videoUrl: string,
  videoId?: string,
): Promise<AudioResult | null> {
  const platform = detectPlatform(videoUrl);
  const url = await fetchYouTubeAudioUrl(videoUrl, videoId);

  if (url) {
    return { url, method: 'client', platform };
  }
  return null;
}

export default fetchYouTubeAudioUrl;
