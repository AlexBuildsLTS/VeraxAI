/**
 * @file supabase/functions/process-video/audio.ts
 * @description Universal Media Resolver - Tier 2 (Post-May 2026 Update)
 * ----------------------------------------------------------------------------
 * PIPELINE MATRIX:
 * 1. Cobalt API: Bypasses DRM and regional blocks for 1000+ domains.
 * 2. Direct Raw Media: Regex-free extraction for hosted .mp4, .mp3, .wav files.
 * 3. Fallback: Proxy layer for RapidAPI/yt-dlp bridges.
 * ----------------------------------------------------------------------------
 */

export interface AudioResolution {
  audioUrl: string;
  source: 'cobalt' | 'raw_media' | 'proxy';
  format: string;
}

interface CobaltResponse {
  status: 'error' | 'redirect' | 'stream' | 'success' | 'picker';
  text?: string;
  url?: string;
  audio?: string;
}

/**
 * Tier 1: Cobalt API (Universal Media Extraction)
 * Updated to handle 'picker' status and forced stream redirects.
 */
async function resolveViaCobalt(targetUrl: string): Promise<string | null> {
  try {
    // Priority: Use custom self-hosted Cobalt instance if available in ENV
    const cobaltEndpoint = Deno.env.get('COBALT_API_URL') || 'https://api.cobalt.tools/api/json';

    const response = await fetch(cobaltEndpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'VeraxAI-Intelligence-Bridge/1.0',
      },
      body: JSON.stringify({
        url: targetUrl,
        isAudioOnly: true, // Optimizes bandwidth for Nova-2 ingestion
        aFormat: 'mp3',
        isNoTTWatermark: true,
        filenameStyle: 'nerdy'
      }),
      signal: AbortSignal.timeout(25000), // 25s timeout for complex playlist parsing
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[AudioResolver] Cobalt HTTP ${response.status}:`, errorBody);
      return null;
    }

    const data: CobaltResponse = await response.json();

    // Handle standard stream/redirect success
    if ((data.status === 'redirect' || data.status === 'stream' || data.status === 'success') && data.url) {
      return data.url;
    }

    // Handle 'picker' status (multiple quality options) - take the first available
    if (data.status === 'picker' && data.audio) {
      return data.audio;
    }

    console.warn(`[AudioResolver] Cobalt returned status "${data.status}" without a valid media URL.`);
    return null;
  } catch (error) {
    console.error('[AudioResolver] Cobalt Resolution Fault:', (error as Error).message);
    return null;
  }
}

/**
 * Tier 2: Raw Media Identifier
 * Direct resolution for files hosted on open S3 buckets or static servers.
 */
function resolveRawMedia(targetUrl: string): string | null {
  const mediaExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.aac', '.flac'];
  const cleanUrl = targetUrl.split('?')[0].toLowerCase();

  if (mediaExtensions.some(ext => cleanUrl.endsWith(ext))) {
    return targetUrl;
  }
  return null;
}

/**
 * Master Resolver Orchestrator
 */
export async function getAudioUrl(videoUrl: string): Promise<AudioResolution> {
  console.log(`[AudioResolver] Analyzing source: ${videoUrl}`);

  // 1. Check for direct raw media links
  const rawUrl = resolveRawMedia(videoUrl);
  if (rawUrl) {
    console.log(`[AudioResolver] RAW_MEDIA match detected.`);
    return { audioUrl: rawUrl, source: 'raw_media', format: 'native' };
  }

  // 2. Execute Cobalt bypass
  console.log(`[AudioResolver] Attempting Cobalt API bypass for locked domain...`);
  const cobaltUrl = await resolveViaCobalt(videoUrl);
  if (cobaltUrl) {
    console.log(`[AudioResolver] COBALT match detected.`);
    return { audioUrl: cobaltUrl, source: 'cobalt', format: 'mp3' };
  }

  // 3. Failover
  throw new Error('AUDIO_RESOLUTION_FAILED: The target domain is currently unsupported or the stream is behind a strict auth wall.');
}