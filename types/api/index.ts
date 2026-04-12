/**
 * types/api/index.ts
 * Comprehensive type definitions for VeraxAI API layer.
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. 100% DB SYNC: Nullable fields perfectly match database.types.ts.
 * 2. STRICT ENUMS: Extraction methods and statuses locked to DB enums.
 * 3. EXPORT SCHEMAS: Formatted cleanly for the ExportBuilder.
 */

export type VideoStatus =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'transcribing'
  | 'ai_processing'
  | 'completed'
  | 'failed';

export type ExtractionMethod =
  | 'youtube_api'
  | 'youtube_dl'
  | 'timedtext'
  | 'watchpage_scrape'
  | 'innertube'
  | 'invidious'
  | 'rapidapi'
  | 'deepgram'
  | 'client'
  | 'gemini-3.1-flash-lite-preview'
  | 'unknown';

export type ContentDifficulty = 'beginner' | 'standard' | 'advanced';

export type SupportedLanguage =
  | 'english'
  | 'spanish'
  | 'french'
  | 'german'
  | 'italian'
  | 'portuguese'
  | 'dutch'
  | 'polish'
  | 'russian'
  | 'japanese'
  | 'korean'
  | 'chinese';

export interface ProcessVideoRequest {
  video_id: string;
  video_url: string;
  language?: string;
  difficulty?: ContentDifficulty;
  transcript_text?: string | null;
  audio_url?: string | null;
}

export interface ProcessVideoResponse {
  success: boolean;
  video_id: string;
  method: ExtractionMethod | string;
  transcript_length: number;
  has_insights: boolean;
  error?: string;
}

export interface CaptionResult {
  text: string;
  json: unknown;
  method: ExtractionMethod | string;
  language?: string;
  confidence?: number;
}

export interface AudioResult {
  url: string;
  method: string;
  quality?: string;
  mime_type?: string;
}

export interface Chapter {
  timestamp: string;
  title: string;
  description: string;
  start_seconds?: number;
}

export interface SeoMetadata {
  tags: string[];
  suggested_titles: string[];
  description: string;
}

export interface AiInsights {
  id?: string;
  video_id?: string;
  ai_model: string;
  language: string;
  summary: string | null; // Synced with DB
  chapters: Chapter[];
  key_takeaways: string[];
  seo_metadata: SeoMetadata;
  tokens_used: number | null; // Synced with DB
  processed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InsightsRequest {
  video_id: string;
  transcript_text: string;
  language?: string;
  difficulty?: ContentDifficulty;
}

export interface InsightsResponse {
  success: boolean;
  insights: AiInsights;
  error?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptJson {
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
  word_count?: number;
  source: ExtractionMethod | string;
}

export interface Transcript {
  id: string;
  video_id: string;
  language_code: string;
  transcript_text: string;
  transcript_json: TranscriptJson | null; // Synced with DB
  confidence_score: number | null; // Synced with DB
  word_count: number | null; // Synced with DB
  reading_time_minutes: number | null; // Synced with DB
  extraction_method: string | null; // Synced with DB
  created_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  youtube_url: string;
  youtube_video_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: VideoStatus;
  error_message: string | null;
  processing_provider: string | null;
  audio_url: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_duration_ms: number | null;
  retry_count: number | null;
  last_retry_at: string | null;
  batch_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoWithRelations extends Video {
  transcripts: Transcript[];
  ai_insights: AiInsights | null;
}

export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'json' | 'docx' | 'md';

export interface ExportOptions {
  format: ExportFormat;
  includeTimestamps?: boolean;
  includeSpeakers?: boolean;
  includeChapters?: boolean;
  includeSummary?: boolean;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BatchJob {
  id: string;
  user_id: string;
  name: string;
  status: BatchStatus;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  created_at: string;
  updated_at: string;
}

export interface BatchSubmitRequest {
  video_urls: string[];
  name?: string;
  language?: string;
  difficulty?: ContentDifficulty;
}

export interface BatchSubmitResponse {
  batch_id: string;
  total_videos: number;
  queued_videos: string[];
  invalid_urls: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const ERROR_CODES = {
  INVALID_URL: 'INVALID_URL',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  RATE_LIMITED: 'RATE_LIMITED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  AI_PROCESSING_FAILED: 'AI_PROCESSING_FAILED',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];