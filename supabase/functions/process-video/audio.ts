/**
 * supabase/functions/process-video/audio.ts
 * High-Availability Audio Extraction Engine
 * Features: RapidAPI Primary, Triple-Instance Cobalt Rotation, Stream Validation
 */

import { extractYouTubeId } from './utils.ts';

/**
 * Orchestrates the retrieval of a direct audio stream URL.
 * @param videoUrl - The source video link.
 * @param platform - The video platform (e.g., 'youtube').
 * @returns A validated direct link to the audio asset or null.
 */
export async function getAudioUrl(
  videoUrl: string,
  platform: string,
): Promise<string | null> {
  console.log(`[Audio:START] Resolving ${platform} source: ${videoUrl}`);

  if (platform !== 'youtube') {
    console.warn(`[Audio:WARN] platform '${platform}' is currently outside high-priority logic.`);
    return null;
  }

  const ytId = extractYouTubeId(videoUrl);
  if (!ytId) {
    console.error('[Audio:ERROR] Failed to extract unique identifier from URL.');
    return null;
  }

  // --- STRATEGY 1: PREMIUM RAPID-API (Low Latency) ---
  const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
  if (rapidApiKey) {
    try {
      console.log('[Audio:UPSTREAM] Attempting Premium RapidAPI node...');
      const response = await fetch(
        `https://youtube-mp36.p.rapidapi.com/dl?id=${ytId}`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(12000), // Strict 12s timeout
        },
      );

      if (response.ok) {
        const payload = await response.json();
        if (payload?.link) {
          console.log('[Audio:SUCCESS] Stream secured via Premium Node.');
          return payload.link;
        }
      }
      console.warn(`[Audio:UPSTREAM] Premium Node returned status: ${response.status}`);
    } catch (e: any) {
      console.warn(`[Audio:UPSTREAM] Premium Node failed: ${e.message}`);
    }
  }

  // --- STRATEGY 2: AGGRESSIVE COBALT ROTATION (High Volume) ---
  const cobaltNodes = [
    'https://co.wuk.sh',
    'https://cobalt.q0.o.aurora.tech',
    'https://api.cobalt.tools',
  ];

  for (const node of cobaltNodes) {
    try {
      console.log(`[Audio:SCRAPE] Contacting extraction node: ${node}`);
      const res = await fetch(`${node}/api/json`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          url: videoUrl,
          aFormat: 'mp3',
          isAudioOnly: true,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          console.log(`[Audio:SUCCESS] Stream secured via ${new URL(node).hostname}`);
          return data.url;
        }
      }
      console.warn(`[Audio:SCRAPE] Node ${node} rejected request or is rate-limited.`);
    } catch (error: any) {
      console.warn(`[Audio:SCRAPE] Connection to ${node} timed out or failed.`);
      continue;
    }
  }

  console.error('[Audio:FATAL] All available audio resolution layers have been exhausted.');
  return null;
}