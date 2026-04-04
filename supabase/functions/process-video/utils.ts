/**
 * supabase/functions/process-video/utils.ts
 * Ironclad Utility Suite - Enterprise Production Tier
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. DATABASE SAFETY: Null-byte scrubbing (\u0000) prevents Postgres insertion crashes.
 * 2. MULTI-CONTEXT IDENTIFIER: Advanced regex engine for all known YouTube URL variants.
 * 3. METRIC ANALYTICS: High-precision duration and reading time calculations.
 * 4. TYPE SAFETY: Strictly defined interfaces for JSON3 and VTT parsing.
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
 * Calculates high-precision millisecond delta from a starting epoch.
 * @param startTime - The initial Date.now() timestamp.
 */
export function diffMs(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Enterprise Reading Time Calculator.
 * Derived using the global professional standard of 225 words per minute.
 * @param wordCount - Total words in the processed bitstream.
 */
export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 225;
  const time = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, time);
}

/**
 * PostgreSQL String Sanitizer.
 * MANDATORY: PostgreSQL driver crashes when encountering the null character (\u0000).
 * This function scrubs illegal bytes and normalizes whitespace for optimal storage.
 * @param text - The raw string data.
 */
export function sanitizeForDb(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '') // Remove illegal binary bytes
    .replace(/\s+/g, ' ')   // Collapse whitespace clusters
    .trim();
}

/**
 * Sovereign YouTube Identifier Extraction Engine.
 * @param url - The raw source URL.
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlObject = new URL(url);

    // Pattern Tier 1: Standard Query Parameters
    const queryId = urlObject.searchParams.get('v');
    if (queryId && /^[a-zA-Z0-9_-]{11}$/.test(queryId)) return queryId;

    // Pattern Tier 2: Shortened Domain Logic
    if (urlObject.hostname === 'youtu.be') {
      const pathId = urlObject.pathname.slice(1).split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(pathId)) return pathId;
    }

    // Pattern Tier 3: Path segment analysis
    const pathSegments = urlObject.pathname.split('/');
    const idInPath = pathSegments.find((segment) => /^[a-zA-Z0-9_-]{11}$/.test(segment));
    if (idInPath) return idInPath;
  } catch {
    // URL constructor failed (malformed protocol), executing emergency regex fallback
  }

  // Pattern Tier 4: Aggressive Regex Shield
  const masterRegex = /(?:v=|\/|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/;
  const matchResult = url.match(masterRegex);

  if (matchResult && matchResult[1]) {
    return matchResult[1];
  }

  return null;
}

/**
 * YouTube JSON3 Event Decoder.
 * Parses undocumented internal event streams into normalized executive text.
 * @param jsonData - The raw object or string retrieved from the TimedText API.
 */
export function parseJson3(jsonData: unknown): string | null {
  if (!jsonData) return null;

  try {
    const data = (typeof jsonData === 'string'
      ? JSON.parse(jsonData)
      : jsonData) as Json3Data;

    // Verify root structure integrity
    if (!data?.events || !Array.isArray(data.events)) {
      return null;
    }

    const segments = data.events as Json3Event[];

    const processedText = segments
      .filter((event: Json3Event) => event.segs && Array.isArray(event.segs))
      .flatMap((event: Json3Event) =>
        event.segs!.map((segment: Json3Segment) => (segment.utf8 ?? '').replace(/\n/g, ' '))
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Minimum character boundary check
    return processedText.length > 50 ? processedText : null;
  } catch (parseErr: any) {
    console.error('[UTILS:JSON3] Parsing exception encountered:', parseErr.message);
    return null;
  }
}

/**
 * Legacy VTT (Web Video Text Tracks) Sanitizer.
 * Strips technical headers, CSS descriptors, and precise timestamps from VTT streams.
 * Optimized with non-backtracking patterns to prevent ReDoS.
 * @param vttContent - The raw VTT string.
 */
export function stripVtt(vttContent: string): string {
  if (!vttContent) return '';

  return vttContent
    // Remove WEBVTT headers and global style blocks
    .replace(/^WEBVTT[\s\S]*?\n\n/i, '')
    // Remove standard duration markers (00:00:00.000 --> 00:00:01.000)
    .replace(/^\d{2,}:\d{2}:\d{2}\.\d{3}\s+-->\s+.*$/gm, '')
    // Remove standalone floating timestamps
    .replace(/^\d{2,}:\d{2}:\d{2}\.\d{3}$/gm, '')
    // Remove inline XML/HTML style tags (e.g. <c.color>)
    .replace(/<[^>]+>/g, '')
    // HTML entity decoding layer for common auto-caption characters
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Structural normalization
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Semantic Keyword Analytics.
 * Generates frequency-based metadata for automated tagging and SEO.
 * @param text - The full transcript text.
 * @param limit - Max number of keywords to return.
 */
export function getKeywordDensity(text: string, limit = 10): string[] {
  if (!text) return [];

  // Extract words longer than 4 characters to filter out common stop-words
  const words = text.toLowerCase().match(/\b(\w{4,})\b/g);
  if (!words) return [];

  const frequencyMap: Record<string, number> = {};
  words.forEach((word) => {
    frequencyMap[word] = (frequencyMap[word] || 0) + 1;
  });

  // Sort by occurrence and return top results
  return Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}