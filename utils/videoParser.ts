/**
 * utils/videoParser.ts
 * Bulletproof Video URL Parser for Multi-Platform Support.
 * Handles Shorts, Live streams, Embeds, standard URLs, and mobile links.
 */

export type VideoPlatform = 'youtube' | 'vimeo' | 'patreon' | 'unknown';

export interface ParsedVideo {
  isValid: boolean;
  platform: VideoPlatform;
  videoId: string | null;
  normalizedUrl: string | null; // Added to ensure the backend gets a clean URL
}

export function parseVideoUrl(url: string): ParsedVideo {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      platform: 'unknown',
      videoId: null,
      normalizedUrl: null,
    };
  }

  const cleanUrl = url.trim();

  // ─── 1. YOUTUBE (The Ultimate Regex) ──────────────────────────────────────
  // Matches:
  // - youtube.com/watch?v=ID
  // - youtu.be/ID
  // - youtube.com/shorts/ID
  // - youtube.com/embed/ID
  // - youtube.com/live/ID
  // - m.youtube.com/...
  const ytRegex =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:\S+)?/i;

  const ytMatch = cleanUrl.match(ytRegex);

  if (ytMatch && ytMatch[1]) {
    const extractedId = ytMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId: extractedId,
      // Normalize the URL so the backend always receives a standard format
      normalizedUrl: `https://www.youtube.com/watch?v=${extractedId}`,
    };
  }

  // ─── 2. VIMEO ─────────────────────────────────────────────────────────────
  // Matches:
  // - vimeo.com/ID
  // - player.vimeo.com/video/ID
  const vimeoRegex =
    /(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/i;

  const vimeoMatch = cleanUrl.match(vimeoRegex);

  if (vimeoMatch && vimeoMatch[1]) {
    const extractedId = vimeoMatch[1];
    return {
      isValid: true,
      platform: 'vimeo',
      videoId: extractedId,
      normalizedUrl: `https://vimeo.com/${extractedId}`,
    };
  }

  // ─── 3. PATREON ───────────────────────────────────────────────────────────
  if (cleanUrl.toLowerCase().includes('patreon.com/')) {
    return {
      isValid: true,
      platform: 'patreon',
      videoId: cleanUrl, // For Patreon, the URL is the ID until scraped
      normalizedUrl: cleanUrl,
    };
  }

  // ─── FALLBACK ─────────────────────────────────────────────────────────────
  return {
    isValid: false,
    platform: 'unknown',
    videoId: null,
    normalizedUrl: null,
  };
}
