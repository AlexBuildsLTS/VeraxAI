/**
 * supabase/functions/process-video/insights.ts
 * Master AI Insights Generation — Gemini 3.1 Flash-Lite
 * ----------------------------------------------------------------------------
 * ARCHITECTURE & PROTOCOLS:
 * 1. STRICT SCHEMA ENFORCEMENT: Guarantees 100% valid JSON payload parsing.
 * 2. CASCADING HYBRID ROTATION: Prioritizes BYOK (User Key) -> Master Env Key -> DB Fallback Keys.
 * 3. RLS BYPASS: Uses Service Role Key to securely access the invisible API Vault.
 * 4. SANITIZATION: Aggressively trims API keys to prevent UI whitespace crashes.
 * 5. ADVANCED TELEMETRY: Tracks and returns the exact 'used_key_alias' for UI Charts.
 * ----------------------------------------------------------------------------
 */

import { GoogleGenerativeAI, SchemaType, ResponseSchema } from 'npm:@google/generative-ai@^0.24.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── INTELLIGENCE SCHEMA DEFINITION ──────────────────────────────────────────
const InsightsSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: 'A highly professional, comprehensive executive summary. MUST utilize rich Markdown formatting (bolding key terms) for readability. Scales dynamically in depth.',
    },
    conclusion: {
      type: SchemaType.STRING,
      description: 'A definitive, professional 2-3 sentence concluding synthesis. Distills the ultimate core lesson.',
    },
    chapters: {
      type: SchemaType.ARRAY,
      description: 'Chronological chapters mapping the narrative. Scales between 1 to 8 chapters based on length.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          timestamp: { type: SchemaType.STRING, description: 'Format strictly as MM:SS or HH:MM:SS based on audio cues.' },
          title: { type: SchemaType.STRING, description: 'A highly engaging, professional title for this segment.' },
          description: { type: SchemaType.STRING, description: 'Deeply accurate explanation. Use Markdown bullet points if listing multiple sub-topics.' },
        },
        required: ['timestamp', 'title', 'description'],
      },
    },
    key_takeaways: {
      type: SchemaType.ARRAY,
      description: 'The absolute most important, profound, and actionable insights. Max 5 to 8. Formatted as punchy, standalone statements.',
      items: { type: SchemaType.STRING },
    },
    seo_metadata: {
      type: SchemaType.OBJECT,
      description: 'Highly optimized SEO metadata for content categorization and algorithmic discovery.',
      properties: {
        tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'High-value search keywords.' },
        suggested_titles: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Click-optimized, professional title alternatives.' },
        description: { type: SchemaType.STRING, description: 'A compelling 160-character meta description.' },
      },
      required: ['tags', 'suggested_titles', 'description'],
    },
  },
  required: ['summary', 'conclusion', 'chapters', 'key_takeaways', 'seo_metadata'],
};

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
export type InsightsResult = {
  model: string;
  summary: string;
  conclusion: string;
  chapters: { timestamp: string; title: string; description: string }[];
  key_takeaways: string[];
  seo_metadata: {
    tags: string[];
    suggested_titles: string[];
    description: string;
  };
  tokens_used: number;
  used_key_alias: string;
};

// ─── UTILITY ENGINES ─────────────────────────────────────────────────────────

function extractCleanJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end >= start) {
    return text.substring(start, end + 1);
  }
  return text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
}

async function withRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Insights:Retry] Attempt ${attempt}/${maxAttempts} failed: ${msg}`);
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('Retry loop exhausted.');
}

function getContentCategory(transcript: string): 'short' | 'medium' | 'long' {
  const wordCount = transcript.split(/\s+/).length;
  if (wordCount < 1000) return 'short';
  if (wordCount < 5000) return 'medium';
  return 'long';
}

// ─── HYBRID KEY FETCHING ENGINE ─────────────────────────────────────────────

async function getCascadingKeys(userCustomKey?: string): Promise<{ id: string | null, key: string, alias: string }[]> {
  const keys: { id: string | null, key: string, alias: string }[] = [];

  // 0. User's Custom Key (BYOK) - Absolute Highest Priority
  if (userCustomKey && userCustomKey.trim().length > 0) {
    keys.push({ id: null, key: userCustomKey.trim(), alias: 'USER_BYOK' });
  }

  // 1. Master Environment Key
  const primary = Deno.env.get('GEMINI_API_KEY');
  if (primary && primary.trim().length > 0) {
    keys.push({ id: null, key: primary.trim(), alias: 'ENV_MASTER' });
  }

  // 2. Fetch UI Fallback Keys from DB
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (supabaseUrl && serviceKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const { data: dbKeys, error } = await supabaseAdmin
        .from('system_api_keys')
        .select('id, name, encrypted_key')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (dbKeys && dbKeys.length > 0) {
        for (const k of dbKeys) {
          if (k.encrypted_key && k.encrypted_key.trim().length > 0) {
            keys.push({ id: k.id, key: k.encrypted_key.trim(), alias: k.name });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Insights:KeyFetch] Failed to pull fallback keys from DB:', err);
  }

  return keys;
}

// ─── MAIN GENERATION PIPELINE ────────────────────────────────────────────────

export async function generateInsights(
  transcript: string,
  language: string,
  difficulty: string,
  userCustomKey?: string // Inject BYOK parameter
): Promise<InsightsResult> {

  const apiKeys = await getCascadingKeys(userCustomKey);

  if (apiKeys.length === 0) {
    throw new Error('GEMINI_CONFIG_ERROR: No API keys configured in Environment or Database.');
  }

  const category = getContentCategory(transcript);
  const targetModel = 'gemini-3.1-flash-lite-preview';

  console.log(`[Insights] Model: ${targetModel} | Keys Loaded: ${apiKeys.length} | Priority 1: ${apiKeys[0].alias}`);

  const safeTranscript = transcript.length > 800000
    ? transcript.substring(0, 800000)
    : transcript;

  const prompt = buildPrompt(safeTranscript, language, difficulty, category);

  let lastError: unknown;

  // ─── CASCADING ROTATION LOOP ───
  for (let i = 0; i < apiKeys.length; i++) {
    const currentKeyObj = apiKeys[i];
    console.log(`[Insights] Attempting generation with API Key alias: ${currentKeyObj.alias}`);

    try {
      const cleanKey = currentKeyObj.key.trim();
      const genAI = new GoogleGenerativeAI(cleanKey);
      const model = genAI.getGenerativeModel({
        model: targetModel,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: InsightsSchema,
          temperature: 0.15,
        },
      });

      const startTime = Date.now();
      const result = await withRetry(() => model.generateContent(prompt));

      const responseText = result.response.text();
      if (!responseText) throw new Error('EMPTY_RESPONSE: Gemini returned no content.');

      const parsed = JSON.parse(extractCleanJson(responseText));
      const elapsed = Date.now() - startTime;
      const tokens = result.response.usageMetadata?.totalTokenCount ?? 0;

      console.log(`[Insights] ✓ Success! Generated in ${elapsed}ms using ${currentKeyObj.alias} | Tokens: ${tokens}`);

      // Sync telemetry ONLY for system keys, user BYOK keys don't count towards system burn
      if (currentKeyObj.id) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          if (supabaseUrl && serviceKey) {
            const supabaseAdmin = createClient(supabaseUrl, serviceKey);
            await supabaseAdmin.rpc('increment_key_burn', {
              key_id: currentKeyObj.id,
              token_amount: tokens
            });
          }
        } catch (telemetryErr) {
          console.warn('[Insights:Telemetry] Failed to sync token burn to DB:', telemetryErr);
        }
      }

      return {
        model: targetModel,
        summary: parsed.summary ?? '',
        conclusion: parsed.conclusion ?? '',
        chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
        key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
        seo_metadata: parsed.seo_metadata ?? { tags: [], suggested_titles: [], description: '' },
        tokens_used: tokens,
        used_key_alias: currentKeyObj.alias,
      };

    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Insights:KeyRotation] Alias ${currentKeyObj.alias} failed: ${msg}. Falling back to next key...`);
    }
  }

  console.error('[Insights:FATAL] All provided API keys exhausted or rate-limited.');
  throw new Error(`INSIGHTS_GENERATION_FAILED: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

// ─── ELITE PROMPT ENGINEERING CORE ───────────────────────────────────────────

function buildPrompt(
  transcript: string,
  language: string,
  difficulty: string,
  category: 'short' | 'medium' | 'long',
): string {
  const difficultyGuides: Record<string, string> = {
    beginner: 'Use highly accessible, clear language. Define complex terminology simply. Emphasize clarity and approachability.',
    standard: 'Maintain a pristine, professional executive tone. Balance analytical depth with optimal readability.',
    advanced: 'Assume elite domain expertise. Use precise technical, academic, or industry-standard terminology. Provide nuanced, forensic-level analysis.',
  };

  const depthGuide = {
    short: 'Write a highly concentrated 2-paragraph summary. Output exactly 1 to 3 distinct chapters mapping the core shifts.',
    medium: 'Write an elite 3-4 paragraph executive summary. Output exactly 3 to 6 detailed chapters mapping the chronology.',
    long: 'Write a massive, profound 4-6 paragraph executive dossier. Output exactly 5 to 8 major chronological chapters. Do not spam micro-chapters. Group large timeframes into massive, highly detailed descriptions.',
  }[category];

  return `You are VeraxAI's elite, top-tier Senior Intelligence Analyst and Linguistic Expert tasked with producing a flawless, publication-ready dossier.

TASK: Decrypt and analyze the verbatim transcript below to produce perfectly structured, profound insights.

TARGET OUTPUT LANGUAGE: ${language.toUpperCase()}
AUDIENCE CALIBRATION: ${difficulty} — ${difficultyGuides[difficulty] ?? difficultyGuides.standard}

CRITICAL TRANSLATION PROTOCOL (ABSOLUTE OVERRIDE):
1. The JSON schema structure and keys (e.g., "summary", "conclusion", "chapters", "title") MUST remain in pure English. Never translate the JSON keys.
2. ALL string values INSIDE the JSON (the actual generated text, descriptions, takeaways, tags) MUST be translated into ${language.toUpperCase()} with native, grammatical perfection and fluency.
3. If the target language is NOT English, under no circumstances should English text appear in the values unless it is an untranslatable proper noun.

RICH FORMATTING PROTOCOL (MANDATORY):
- You MUST utilize rich Markdown formatting INSIDE the JSON string values.
- Use **bolding** for crucial terms, metrics, or names to make the text scannable.
- Use Markdown lists (- item) inside chapter descriptions if explaining multi-step processes.

CRITICAL COVERAGE PROTOCOL:
- You MUST process the narrative from the absolute 00:00 mark to the FINAL WORD of the transcript. Do not stop analyzing halfway through.
- ${depthGuide}
- Prioritize extreme quality and analytical depth over sheer volume.

STRICT RULES:
1. OUTPUT ONLY VALID JSON. No conversational preamble. No backticks framing the output.
2. Zero hallucinations. Extract and synthesize data strictly from the provided text.

VERBATIM TRANSCRIPT:
"""
${transcript}
"""`;
}