/**
 * lib/api/functions.ts
 * Enterprise Edge Function Invocation Service
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. STRICT SYNC: Payload interfaces perfectly match the `process-video` edge function.
 * 2. TYPE SAFETY: Complete request/response typing.
 * 3. ERROR BOUNDARIES: Standardized error extraction from Supabase invocations.
 */

import { supabase } from '../supabase/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProcessVideoPayload {
  video_id: string;
  video_url: string;
  platform?: string;
  transcript_text?: string | null;
  language?: string;
  difficulty?: string;
}

export interface ProcessVideoResponse {
  success: boolean;
  id?: string;
  error?: string;
  metrics?: {
    duration_ms: number;
    words: number;
  };
  stage?: string; // Present if failed
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ABSTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

export const EdgeFunctions = {
  /**
   * Triggers the Sovereign Video Processing Pipeline.
   * Matches the exact snake_case schema expected by the Deno Edge Function.
   */
  async processVideo(payload: ProcessVideoPayload): Promise<ProcessVideoResponse> {
    console.log(`[API_UPLINK] Invoking process-video for ${payload.video_id}...`);

    const { data, error } = await supabase.functions.invoke<ProcessVideoResponse>('process-video', {
      body: {
        video_id: payload.video_id,
        video_url: payload.video_url,
        platform: payload.platform || 'youtube',
        transcript_text: payload.transcript_text || null,
        language: payload.language || 'English',
        difficulty: payload.difficulty || 'standard',
      },
    });

    // 1. Handle Network / Edge Gateway Errors (e.g., 500, Function Not Found)
    if (error) {
      console.error('[API_UPLINK_FAILURE] Edge function network exception:', error);
      throw new Error(`Gateway Error: ${error.message || 'Failed to reach processing node'}`);
    }

    // 2. Handle Logical Pipeline Errors (e.g., 200 OK, but success: false)
    if (data && data.success === false) {
      console.error(`[API_PIPELINE_REJECTION] Node failed at stage [${data.stage || 'unknown'}]: ${data.error}`);
      throw new Error(data.error || 'The remote pipeline encountered an unexpected failure.');
    }

    return data as ProcessVideoResponse;
  },
};