// cSpell:disable
/**
 * services/exportBuilder.ts
 * Professional Transcript & Intelligence Export Service
 * ----------------------------------------------------------------------------
 * Features:
 * - 100% Synchronized with Supabase database.types.ts
 * - Defensive JSON parsing for Supabase 'Json' DB types
 * - Premium Executive Formatting for TXT and Markdown
 * - Automatic SRT/VTT generation from raw text if timestamps are missing
 */

import {
  formatTimestamp,
  formatSrtTimestamp,
  formatVttTimestamp,
  formatDuration,
} from '../utils/formatters/time';
import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  Transcript,
  TranscriptSegment,
  AiInsights,
  Video,
} from '../types/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

interface ExportData {
  video: Video;
  transcript: Transcript;
  insights?: AiInsights | null;
  segments?: TranscriptSegment[];
}

interface ParsedChapter {
  timestamp: string;
  title: string;
  description: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  txt: 'text/plain',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  json: 'application/json',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Defensive utility to safely extract arrays from Supabase JSON fields
 */
function safeArray<T>(data: any): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Defensive utility to safely extract objects from Supabase JSON fields
 */
function safeObject(data: any): Record<string, any> {
  if (!data) return {};
  return typeof data === 'object' && !Array.isArray(data) ? data : {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAIN TEXT EXPORT (EXECUTIVE BRIEF)
// ═══════════════════════════════════════════════════════════════════════════════

function exportToTxt(data: ExportData, options: ExportOptions): string {
  const { video, transcript, insights } = data;
  const lines: string[] = [];
  const chapters = safeArray<ParsedChapter>(insights?.chapters);
  const takeaways = safeArray<string>(insights?.key_takeaways);

  // --- DOCUMENT HEADER ---
  lines.push('════════════════════════════════════════════════════════════════════════');
  lines.push(`EXECUTIVE TRANSCRIPT: ${video.title || 'Untitled Media'}`);
  lines.push('════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Source URL : ${video.youtube_url}`);
  if (video.duration_seconds) lines.push(`Duration   : ${formatDuration(video.duration_seconds)}`);
  lines.push(`Generated  : ${new Date().toUTCString()}`);
  lines.push('');

  // --- EXECUTIVE SUMMARY ---
  if (options.includeSummary && insights?.summary) {
    lines.push('─── EXECUTIVE SUMMARY ──────────────────────────────────────────────────');
    lines.push('');
    lines.push(insights.summary);
    lines.push('');
  }

  // --- KEY TAKEAWAYS ---
  if (options.includeSummary && takeaways.length > 0) {
    lines.push('─── KEY TAKEAWAYS ──────────────────────────────────────────────────────');
    lines.push('');
    takeaways.forEach((takeaway, i) => lines.push(`${i + 1}. ${takeaway}`));
    lines.push('');
  }

  // --- CHRONOLOGICAL CHAPTERS ---
  if (options.includeChapters && chapters.length > 0) {
    lines.push('─── INDEX & CHAPTERS ───────────────────────────────────────────────────');
    lines.push('');
    chapters.forEach((chapter) => {
      lines.push(`[${chapter.timestamp}] ${chapter.title.toUpperCase()}`);
      if (chapter.description) lines.push(`    ${chapter.description}`);
      lines.push('');
    });
  }

  // --- VERBATIM TRANSCRIPT ---
  lines.push('─── FULL TRANSCRIPT ────────────────────────────────────────────────────');
  lines.push('');

  if (options.includeTimestamps && data.segments && data.segments.length > 0) {
    data.segments.forEach((segment) => {
      const timestamp = formatTimestamp(segment.start);
      const speaker = options.includeSpeakers && segment.speaker ? `[${segment.speaker}] ` : '';
      lines.push(`[${timestamp}] ${speaker}${segment.text}`);
    });
  } else {
    // Apply basic word wrapping/paragraphing for unsegmented text
    const paragraphs = transcript.transcript_text.split(/(?<=[.!?])\s+/);
    let currentParagraph = '';
    paragraphs.forEach((sentence, i) => {
      currentParagraph += (currentParagraph ? ' ' : '') + sentence;
      // Break into paragraphs every ~6 sentences
      if (i % 6 === 5 || i === paragraphs.length - 1) {
        lines.push(currentParagraph.trim());
        lines.push('');
        currentParagraph = '';
      }
    });
  }

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════════════════');
  lines.push('Generated securely by TranscriberPro Intelligence');
  lines.push('════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SRT & VTT TIMESTAMPS EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function createSrtFromPlainText(text: string, durationSeconds?: number | null): string {
  const words = text.split(/\s+/);
  const wordsPerSegment = 12; // Adjusted for better readability on screen
  const totalDuration = durationSeconds || (words.length / 150) * 60;
  const segmentDuration = totalDuration / Math.ceil(words.length / wordsPerSegment);

  const lines: string[] = [];
  let segmentIndex = 1;

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    const start = (i / wordsPerSegment) * segmentDuration;
    const end = Math.min(start + segmentDuration, totalDuration);

    lines.push(String(segmentIndex++));
    lines.push(`${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}`);
    lines.push(segmentWords.join(' '));
    lines.push('');
  }
  return lines.join('\n');
}

function exportToSrt(data: ExportData, options: ExportOptions): string {
  const segments = data.segments || [];
  if (segments.length === 0) {
    return createSrtFromPlainText(data.transcript.transcript_text, data.video.duration_seconds);
  }

  const lines: string[] = [];
  segments.forEach((segment, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}`);
    let text = segment.text;
    if (options.includeSpeakers && segment.speaker) text = `[${segment.speaker}] ${text}`;
    lines.push(text);
    lines.push('');
  });
  return lines.join('\n');
}

function exportToVtt(data: ExportData, options: ExportOptions): string {
  const segments = data.segments || [];
  const chapters = safeArray<ParsedChapter>(data.insights?.chapters);
  const lines: string[] = ['WEBVTT', ''];

  lines.push(`NOTE`);
  lines.push(`Title: ${data.video.title || 'Untitled'}`);
  lines.push(`Source: ${data.video.youtube_url}`);
  lines.push('');

  if (options.includeChapters && chapters.length > 0) {
    chapters.forEach((chapter) => {
      lines.push(`NOTE Chapter: [${chapter.timestamp}] ${chapter.title}`);
    });
    lines.push('');
  }

  if (segments.length === 0) {
    const srt = createSrtFromPlainText(data.transcript.transcript_text, data.video.duration_seconds);
    const vttBody = srt
      .replace(/^\d+$/gm, '') // Remove SRT sequence numbers
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // Change comma to dot for milliseconds
      .split('\n').filter(l => l.trim()).join('\n\n');
    lines.push(vttBody);
  } else {
    segments.forEach((segment, index) => {
      if (index > 0) lines.push('');
      lines.push(`${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}`);
      let text = segment.text;
      if (options.includeSpeakers && segment.speaker) text = `<v ${segment.speaker}>${text}`;
      lines.push(text);
    });
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON & MARKDOWN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function exportToJson(data: ExportData, options: ExportOptions): string {
  const output: Record<string, unknown> = {
    metadata: {
      title: data.video.title,
      source: data.video.youtube_url,
      videoId: data.video.youtube_video_id,
      duration: data.video.duration_seconds,
      generatedAt: new Date().toISOString(),
      wordCount: data.transcript.word_count,
      language: data.transcript.language_code,
      extractionMethod: data.transcript.extraction_method,
      confidence: data.transcript.confidence_score,
    },
    transcript: {
      text: data.transcript.transcript_text,
      // Fixed: Guarantees an array is returned instead of undefined to satisfy TypeScript
      segments: options.includeTimestamps ? (data.segments || []) : [],
    },
  };

  if (options.includeSummary && data.insights) {
    output.insights = {
      model: data.insights.ai_model,
      summary: data.insights.summary,
      keyTakeaways: safeArray(data.insights.key_takeaways),
      seoMetadata: safeObject(data.insights.seo_metadata),
    };
  }

  const chapters = safeArray<ParsedChapter>(data.insights?.chapters);
  if (options.includeChapters && chapters.length > 0) {
    output.chapters = chapters;
  }

  return JSON.stringify(output, null, 2);
}

function exportToMarkdown(data: ExportData, options: ExportOptions): string {
  const { video, transcript, insights } = data;
  const chapters = safeArray<ParsedChapter>(insights?.chapters);
  const takeaways = safeArray<string>(insights?.key_takeaways);
  const lines: string[] = [];

  lines.push(`# ${video.title || 'Executive Transcript'}`);
  lines.push('');
  lines.push('## Document Information');
  lines.push('');
  lines.push(`- **Source:** [View Media](${video.youtube_url})`);
  if (video.duration_seconds) lines.push(`- **Duration:** ${formatDuration(video.duration_seconds)}`);
  lines.push(`- **Generated:** ${new Date().toLocaleDateString()}`);
  lines.push('');

  if (options.includeSummary && insights?.summary) {
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(insights.summary);
    lines.push('');
  }

  if (options.includeSummary && takeaways.length > 0) {
    lines.push('## Strategic Takeaways');
    lines.push('');
    takeaways.forEach((t) => lines.push(`* ${t}`));
    lines.push('');
  }

  if (options.includeChapters && chapters.length > 0) {
    lines.push('## Timeline & Chapters');
    lines.push('');
    lines.push('| Timestamp | Subject | Details |');
    lines.push('| :--- | :--- | :--- |');
    chapters.forEach((c) => {
      // Escape pipes for markdown tables
      const desc = c.description?.replace(/\|/g, '&#124;') || '';
      lines.push(`| \`${c.timestamp}\` | **${c.title}** | ${desc} |`);
    });
    lines.push('');
  }

  lines.push('## Complete Transcript');
  lines.push('');

  if (options.includeTimestamps && data.segments && data.segments.length > 0) {
    data.segments.forEach((seg) => {
      const ts = formatTimestamp(seg.start);
      const speaker = options.includeSpeakers && seg.speaker ? `**${seg.speaker}:** ` : '';
      lines.push(`*\\[${ts}\\]* ${speaker}${seg.text}  `);
    });
  } else {
    // Elegant paragraphing for readability
    const paragraphs = transcript.transcript_text.split(/(?<=[.!?])\s+/);
    let currentParagraph = '';
    paragraphs.forEach((sentence, i) => {
      currentParagraph += (currentParagraph ? ' ' : '') + sentence;
      if (i % 6 === 5 || i === paragraphs.length - 1) {
        lines.push(currentParagraph.trim());
        lines.push('');
        currentParagraph = '';
      }
    });
  }

  lines.push('---');
  lines.push('*Automated generation via [TranscriberPro](https://transcriberpro.ai)*');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export function exportTranscript(data: ExportData, options: ExportOptions): ExportResult {
  const { format } = options;
  const filename = generateFilename(data.video, format);
  let content: string;

  switch (format) {
    case 'txt': content = exportToTxt(data, options); break;
    case 'srt': content = exportToSrt(data, options); break;
    case 'vtt': content = exportToVtt(data, options); break;
    case 'json': content = exportToJson(data, options); break;
    case 'md': content = exportToMarkdown(data, options); break;
    case 'docx': content = exportToMarkdown(data, options); break; // Fallback payload
    default: content = exportToTxt(data, options);
  }

  return {
    content,
    filename,
    mimeType: MIME_TYPES[format] || 'text/plain',
  };
}

function generateFilename(video: Video, format: ExportFormat): string {
  const title = (video.title || video.youtube_video_id || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 45);
  return `transcriberpro-${title}.${format}`;
}

export function downloadExport(result: ExportResult): void {
  if (typeof document === 'undefined') return; // Server-side rendering safety

  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export async function copyExportToClipboard(result: ExportResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(result.content);
    return true;
  } catch {
    return false;
  }
}

export const ExportBuilder = {
  exportTranscript,
  downloadExport,
  copyExportToClipboard,
  formats: ['txt', 'srt', 'vtt', 'json', 'md'] as ExportFormat[],
  mimeTypes: MIME_TYPES,
};

export default ExportBuilder;