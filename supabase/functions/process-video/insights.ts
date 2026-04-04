/**
 * supabase/functions/process-video/insights.ts
 * Enterprise Intelligence Engine
 * 2026 Compliant: Uses the modern Google GenAI SDK pattern and handles model deprecation gracefully.
 */

import {
  GoogleGenerativeAI,
  SchemaType,
} from 'https://esm.sh/@google/generative-ai@0.21.0';

const InsightsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: 'Comprehensive executive summary adapted to content length. Must be highly professional.',
    },
    chapters: {
      type: SchemaType.ARRAY,
      description: 'Chronological segments for video navigation. Empty for content under 2 minutes.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          timestamp: {
            type: SchemaType.STRING,
            description: 'Format: MM:SS or HH:MM:SS',
          },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ['timestamp', 'title', 'description'],
      },
    },
    key_takeaways: {
      type: SchemaType.ARRAY,
      description: '3-5 highly actionable, substantive points. Quality over quantity.',
      items: { type: SchemaType.STRING },
    },
    seo_metadata: {
      type: SchemaType.OBJECT,
      properties: {
        tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        suggested_titles: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        description: {
          type: SchemaType.STRING,
          description: '150-160 character meta description',
        },
      },
      required: ['tags', 'suggested_titles', 'description'],
    },
  },
  required: ['summary', 'chapters', 'key_takeaways', 'seo_metadata'],
};

export interface InsightsResult {
  model: string;
  summary: string;
  chapters: { timestamp: string; title: string; description: string }[];
  key_takeaways: string[];
  seo_metadata: {
    tags: string[];
    suggested_titles: string[];
    description: string;
  };
}

function getContentCategory(transcript: string): 'short' | 'medium' | 'long' {
  const wordCount = transcript.split(/\s+/).length;
  if (wordCount < 1000) return 'short'; // ~6 mins or less
  if (wordCount < 5000) return 'medium'; // ~6 to 30 mins
  return 'long';
}

export async function generateInsights(
  transcript: string,
  language: string,
  difficulty: string,
): Promise<InsightsResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Edge Function secrets.');
  }

  const category = getContentCategory(transcript);
  const genAI = new GoogleGenerativeAI(apiKey);
  const targetModel = 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel({
    model: targetModel,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: InsightsSchema,
      temperature: 0.2, // Low temperature for factual, analytical extraction
    },
  });

  const prompt = buildIntelligentPrompt(
    transcript,
    language,
    difficulty,
    category,
  );

  try {
    console.log(`[Insights] Sending payload to ${targetModel}...`);
    const result = await model.generateContent(prompt);

    if (!result.response.text()) {
      throw new Error('Model returned an empty response string.');
    }

    const parsed = JSON.parse(result.response.text());

    return {
      model: targetModel,
      summary: parsed.summary || 'Summary unavailable.',
      chapters: parsed.chapters || [],
      key_takeaways: parsed.key_takeaways || [],
      seo_metadata: parsed.seo_metadata || {
        tags: [],
        suggested_titles: [],
        description: '',
      },
    };
  } catch (error: any) {
    console.error(`[Insights] AI Generation failed:`, error);
    throw new Error(`Failed to generate intelligence payload: ${error.message}`);
  }
}

function buildIntelligentPrompt(
  transcript: string,
  language: string,
  difficulty: string,
  category: 'short' | 'medium' | 'long',
): string {
  const difficultyGuides: Record<string, string> = {
    beginner: 'Use accessible language, avoid deep jargon, and define technical terms clearly.',
    standard: 'Balance clarity with professional precision. Suitable for a general business audience.',
    advanced: 'Use precise, domain-specific technical language. Assume expert-level knowledge.',
  };

  const guidelines = {
    short: 'Write 2-3 substantial paragraphs for the summary. Chapters are optional unless clear topic shifts exist.',
    medium: 'Write 3-4 paragraphs for the summary. Extract 3-6 distinct chapters.',
    long: 'Write a comprehensive 4-5 paragraph summary. Extract 6-12 distinct, navigable chapters.',
  }[category];

  return `You are a world-class executive analyst. Your task is to analyze the provided video transcript and produce highly structured, actionable insights.

  CRITICAL DIRECTIVES:
  1. Target Output Language: ${language}. The ENTIRE JSON payload (summary, chapter titles, takeaways, etc.) MUST be natively written in ${language}.
  2. Audience Level: ${difficulty} — ${difficultyGuides[difficulty] || difficultyGuides.standard}
  3. Content Depth: ${guidelines}
  4. Accuracy: Do not hallucinate facts. Only extract information present in the transcript.
  
  Transcript Data:
  ${transcript.slice(0, 800000)}`;
}