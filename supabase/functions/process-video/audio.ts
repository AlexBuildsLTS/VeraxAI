/**
 * process-video/audio.ts
 * Master Audio Resolver for TranscriberPro Edge Functions.
 * Implements a multi-layered extraction strategy:
 * 1. RapidAPI (Paid/High Stability)
 * 2. Cobalt API (Aggressive Proxy Fallback)
 * 3. InnerTube (Internal YouTube API Fallback)
 * GROUNDBREAKING: This version implements "Stream Validation" where every URL
 * found is pre-verified via a HEAD request before being passed to Deepgram.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface AudioStream {
  url: string;
  bitrate?: number;
  mimeType?: string;
  itag?: number;
  ext?: string;
}

/**
 * Verifies if a URL is actually reachable and returns an audio/stream.
 * Prevents passing "dead" or IP-locked links to Deepgram.
 */
async function validateStreamUrl(
  url: string,
  provider: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      console.log(`[Audio] ✓ Validated stream from ${provider}`);
      return true;
    }
    console.warn(
      `[Audio] ⚠ Link from ${provider} returned status ${res.status}`,
    );
    return false;
  } catch {
    return false;
  }
}

/**
 * Method 1: RapidAPI
 * Strategy: Iterates through premium providers to find a high-bitrate direct link.
 */
async function tryRapidAPI(ytId: string): Promise<string | null> {
  const key = Deno.env.get('RAPIDAPI_KEY');
  if (!key) {
    console.warn('[Audio] RAPIDAPI_KEY missing, skipping premium resolution.');
    return null;
  }

  const hosts = [
    { host: 'yt-api.p.rapidapi.com', path: `/dl?id=${ytId}` },
    { host: 'youtube-mp36.p.rapidapi.com', path: `/dl?id=${ytId}` },
    { host: 'youtube-v2.p.rapidapi.com', path: `/video/info?video_id=${ytId}` },
  ];

  for (const { host, path } of hosts) {
    try {
      console.log(`[Audio] Attempting RapidAPI: ${host}`);
      const res = await fetch(`https://${host}${path}`, {
        headers: {
          'X-RapidAPI-Key': key,
          'X-RapidAPI-Host': host,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.error(`[Audio] ${host} failed with HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();

      // Handle multiple JSON schemas across different RapidAPI providers
      const audioUrl =
        data.link ||
        data.url ||
        data.downloadUrl ||
        data.data?.downloadUrl ||
        (data.formats as AudioStream[] | undefined)?.find(
          (f) => f.ext === 'mp3' || f.ext === 'm4a',
        )?.url;

      if (audioUrl && (await validateStreamUrl(audioUrl, host))) {
        return audioUrl;
      }
    } catch (e) {
      console.error(
        `[Audio] Exception during ${host} resolution:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return null;
}

/**
 * Method 2: Cobalt API
 * Strategy: A highly optimized, open-source downloader used as a primary fallback.
 */
async function tryCobalt(videoUrl: string): Promise<string | null> {
  try {
    console.log('[Audio] Attempting Cobalt fallback...');
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        url: videoUrl,
        aFormat: 'mp3',
        isAudioOnly: true,
        vCodec: 'h264',
        vQuality: '720',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[Audio] Cobalt reported error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const resultUrl = data.url || data.audio || data.stream;

    if (resultUrl && (await validateStreamUrl(resultUrl, 'Cobalt'))) {
      return resultUrl;
    }
  } catch (e) {
    console.error(
      '[Audio] Cobalt service exception:',
      e instanceof Error ? e.message : String(e),
    );
  }
  return null;
}

/**
 * Method 3: InnerTube (Internal Android Client)
 * Strategy: Mimics the official YouTube Android app to bypass data-center IP blocks.
 */
async function tryInnerTube(ytId: string): Promise<string | null> {
  try {
    console.log('[Audio] Attempting InnerTube client bypass...');
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          videoId: ytId,
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '19.09.37',
              androidSdkVersion: 30,
              hl: 'en',
              gl: 'US',
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const streamingData = data?.streamingData;
    if (!streamingData) return null;

    const formats: AudioStream[] = [
      ...(streamingData.adaptiveFormats || []),
      ...(streamingData.formats || []),
    ];

    // Sort by highest bitrate, looking for standard audio itags (140, 251)
    const audio = formats
      .filter((f) => f.itag === 140 || f.itag === 251)
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

    if (audio?.url && (await validateStreamUrl(audio.url, 'InnerTube'))) {
      return audio.url;
    }
  } catch (e) {
    console.error(
      '[Audio] InnerTube fatal exception:',
      e instanceof Error ? e.message : String(e),
    );
  }
  return null;
}

/**
 * Main Orchestrator
 * Sequentially attempts methods with increasing aggression to guarantee resolution.
 */
export async function getAudioUrl(
  videoUrl: string,
  ytId: string | null,
): Promise<string> {
  if (!ytId)
    throw new Error('Cannot resolve audio without a valid YouTube ID.');

  console.log(
    `[Audio] 🚀 Starting Master Resolution Sequence for Video ID: ${ytId}`,
  );

  // 1. TRY PREMIUM RAPIDAPI (Lowest latency, most stable)
  const rapid = await tryRapidAPI(ytId);
  if (rapid) return rapid;

  // 2. TRY COBALT (Best fallback for varied platforms)
  const cobalt = await tryCobalt(videoUrl);
  if (cobalt) return cobalt;

  // 3. TRY INNERTUBE (Final local bypass)
  const inner = await tryInnerTube(ytId);
  if (inner) return inner;

  // 4. FATAL FAILURE
  console.error(
    `[Audio] ❌ FAILED: All extraction methods exhausted for ${ytId}`,
  );
  throw new Error(
    'All audio extraction methods blocked by YouTube security. Server IP may be blacklisted.',
  );
}
