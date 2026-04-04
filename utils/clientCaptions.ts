/**
 * utils/clientCaptions.ts
 * Hardened Client-Side Metadata Scraper
 * * Features:
 * - Multi-proxy rotation (CORS bypass)
 * - Deep JSON traversal for undocumented YouTube internal schemas
 * - Aggressive sanitization of raw byte-streams
 * - Zero-crash architecture
 */

export async function fetchClientCaptions(
  videoId: string,
  platform: string = 'youtube',
): Promise<string | null> {
  // Currently optimized for YouTube native extraction
  if (!videoId || platform !== 'youtube') return null;

  console.log(`[Scraper:DEBUG] Starting extraction for ID: ${videoId}`);

  const languageCodes = ['en', 'en-US', 'en-GB', 'a.en', 'en-CA', 'en-AU'];

  /**
   * PROXY ROTATION LIST
   * These are prioritized by reliability and speed.
   */
  const proxyHosts = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://proxy.cors.sh/',
    'https://jsonp.afeld.me/?url='
  ];

  for (const proxy of proxyHosts) {
    for (const lang of languageCodes) {
      try {
        const targetUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
        
        // Dynamic encoding based on proxy requirements
        const fetchUrl = proxy.includes('allorigins') || proxy.includes('jsonp')
          ? `${proxy}${encodeURIComponent(targetUrl)}`
          : `${proxy}${targetUrl}`;

        // 4-second aggressive timeout per proxy attempt
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const data = await res.json();

        // VALIDATION: YouTube JSON3 Response Structure
        if (data && data.events && Array.isArray(data.events)) {
          const processedText = data.events
            .filter((event: any) => event.segs && Array.isArray(event.segs))
            .map((event: any) => {
              return event.segs
                .map((seg: any) => seg.utf8 || '')
                .join('');
            })
            .join(' ')
            .replace(/\s+/g, ' ') // Sanitize multiple spaces
            .replace(/\\n/g, ' ') // Sanitize literal newlines
            .trim();

          // Ensure we have a substantive transcript before returning
          if (processedText.length > 100) {
            console.log(`[Scraper:SUCCESS] Logic finalized via proxy: ${new URL(proxy).hostname}`);
            return processedText;
          }
        }
      } catch (e: any) {
        // Silently fail and rotate to next proxy/language pair
        // This is intentional to prevent UI flickering or crashes.
        continue;
      }
    }
  }

  console.warn(`[Scraper:WARN] All frontend extraction methods exhausted for ${videoId}.`);
  return null;
}