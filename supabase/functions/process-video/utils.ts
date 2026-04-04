/**
 * supabase/functions/process-video/utils.ts
 * Enterprise Utility Suite - Hardened Production Version
 * * FEATURES:
 * 1. Postgres-Safe Sanitization (Removes \u0000 bytes).
 * 2. Multi-Context YouTube ID Extraction.
 * 3. Metrics Engine (Duration/Reading Time).
 * 4. Strict Type Safety (Zero 'any' usage).
 */

/**
 * YouTube JSON3 Internal Structures
 */
export interface Json3Segment {
  utf8?: string;
}

export interface Json3Event {
  segs?: Json3Segment[];
}

export interface Json3Data {
  events?: Json3Event[];
}

/**
 * Calculates the difference in milliseconds from a starting point.
 * @param startTime - The performance.now() or Date.now() start marker.
 */
export function diffMs(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Estimates reading time based on a standard 225 words-per-minute metric.
 * @param wordCount - The total number of words in the transcript.
 */
export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 225;
  const time = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, time);
}

/**
 * Scrubs strings for database safety.
 * PostgreSQL rejects strings containing the null character (\u0000).
 * This function removes null bytes and collapses excessive whitespace.
 */
export function sanitizeForDb(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Advanced YouTube ID Extraction Engine.
 * Supports standard, shorts, live, embed, and shortened URLs.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Pattern A: Standard Query Param (?v=)
    const vParam = urlObj.searchParams.get('v');
    if (vParam && /^[\w-]{11}$/.test(vParam)) return vParam;

    // Pattern B: Shortened Hostname (youtu.be/ID)
    if (urlObj.hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1).split('?')[0];
      if (/^[\w-]{11}$/.test(id)) return id;
    }

    // Pattern C: Path-based identifiers (/embed/, /v/, /shorts/, /live/)
    const pathSegments = urlObj.pathname.split('/');
    const idFromPath = pathSegments.find((segment) =>
      /^[\w-]{11}$/.test(segment),
    );
    if (idFromPath) return idFromPath;
  } catch {
    // If URL parsing fails, fallback to regex scan of the raw string
  }

  const fallbackMatch = url.match(/(?:v=|\/|youtu\.be\/)([\w-]{11})/);
  return fallbackMatch ? fallbackMatch[1] : null;
}

/**
 * Parses internal YouTube JSON3 caption events into high-quality text.
 * Optimized for accuracy and minimal whitespace.
 */
export function parseJson3(jsonData: unknown): string | null {
  if (!jsonData) return null;

  try {
    const data = (
      typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
    ) as Json3Data;

    if (!data?.events || !Array.isArray(data.events)) return null;

    const extracted = data.events
      .filter((e: Json3Event) => e.segs && Array.isArray(e.segs))
      .flatMap((e: Json3Event) =>
        e.segs!.map((s: Json3Segment) => (s.utf8 ?? '').replace(/\n/g, ' ')),
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return extracted.length > 50 ? extracted : null;
  } catch {
    return null;
  }
}

/**
 * Robust VTT (Web Video Text Tracks) Stripper.
 * Uses non-backtracking patterns to prevent ReDoS on large transcripts.
 */
export function stripVtt(vtt: string): string {
  if (!vtt) return '';

  return vtt
    .replace(/^WEBVTT[\s\S]*?\n\n/i, '')
    .replace(
      /^\d{2,}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2,}:\d{2}:\d{2}\.\d{3}.*$/gm,
      '',
    )
    .replace(/^\d{2,}:\d{2}:\d{2}\.\d{3}$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Generates Keyword Density analytics for the transcript.
 */
export function getKeywordDensity(text: string, limit = 10): string[] {
  const words = text.toLowerCase().match(/\b(\w{4,})\b/g);
  if (!words) return [];

  const frequency: Record<string, number> = {};
  words.forEach((w) => {
    frequency[w] = (frequency[w] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}
