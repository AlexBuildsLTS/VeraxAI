/**
 * process-video/insights.ts
 * Gemini 2.5 Flash AI insights generation with INTELLIGENT content adaptation
 *
 * Behavior adapts based on transcript length:
 * - Short videos (<1000 words): Executive summary + key takeaways only
 * - Medium videos (1000-5000 words): 3-6 chapters + summaries
 * - Long videos (5000+ words): 6-12 chapters + section summaries + final summary
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const InsightsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description:
        'Comprehensive executive summary. For short content: 2-3 detailed paragraphs covering the entire piece. For longer content: a thorough overview of all major themes discussed, followed by a concluding synthesis paragraph.',
    },
    chapters: {
      type: SchemaType.ARRAY,
      description:
        'Chronological chapters. ONLY include if content is long enough to have distinct sections. Empty array for very short content.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          timestamp: {
            type: SchemaType.STRING,
            description: 'Timestamp in MM:SS or HH:MM:SS format.',
          },
          title: {
            type: SchemaType.STRING,
            description:
              'A concise, descriptive title that captures the essence of this section.',
          },
          description: {
            type: SchemaType.STRING,
            description:
              'A 2-4 sentence summary explaining what is covered in this chapter and why it matters.',
          },
        },
        required: ['timestamp', 'title', 'description'],
      },
    },
    key_takeaways: {
      type: SchemaType.ARRAY,
      description:
        'The most important, actionable insights. Quality over quantity - 3-5 substantive points that provide real value.',
      items: { type: SchemaType.STRING },
    },
    seo_metadata: {
      type: SchemaType.OBJECT,
      description: 'SEO-optimized metadata for content discovery.',
      properties: {
        tags: {
          type: SchemaType.ARRAY,
          description: 'Relevant keywords and topic tags (8-15 tags).',
          items: { type: SchemaType.STRING },
        },
        suggested_titles: {
          type: SchemaType.ARRAY,
          description:
            '2-3 alternative titles optimized for engagement and searchability.',
          items: { type: SchemaType.STRING },
        },
        description: {
          type: SchemaType.STRING,
          description:
            'A compelling 150-160 character meta description for search results.',
        },
      },
      required: ['tags', 'suggested_titles', 'description'],
    },
  },
  required: ['summary', 'chapters', 'key_takeaways', 'seo_metadata'],
};

type InsightsResult = {
  model: string;
  summary: string;
  chapters: { timestamp: string; title: string; description: string }[];
  key_takeaways: string[];
  seo_metadata: {
    tags: string[];
    suggested_titles: string[];
    description: string;
  };
};

/**
 * Estimates video duration category from transcript word count
 * Average speaking rate: ~150 words/minute
 */
function getContentCategory(transcript: string): 'short' | 'medium' | 'long' {
  const wordCount = transcript.split(/\s+/).length;

  if (wordCount < 1000) return 'short'; // < ~7 minutes
  if (wordCount < 5000) return 'medium'; // ~7-33 minutes
  return 'long'; // > ~33 minutes
}

export async function generateInsights(
  transcript: string,
  language: string,
  difficulty: string,
): Promise<InsightsResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.warn('[Insights] GEMINI_API_KEY not configured');
    return {
      model: 'none',
      summary:
        'Transcript generated successfully. AI analysis unavailable (no API key configured).',
      chapters: [],
      key_takeaways: [],
      seo_metadata: { tags: [], suggested_titles: [], description: '' },
    };
  }

  const contentCategory = getContentCategory(transcript);
  const wordCount = transcript.split(/\s+/).length;

  console.log(
    `[Insights] Content analysis: ${wordCount} words, category: ${contentCategory}`,
  );
  console.log(`[Insights] Initializing Gemini 2.5 Flash...`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: InsightsSchema,
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  const prompt = buildIntelligentPrompt(
    transcript,
    language,
    difficulty,
    contentCategory,
    wordCount,
  );

  try {
    console.log('[Insights] Sending request to Gemini...');
    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error('Gemini returned empty response');
    }

    const parsed = JSON.parse(responseText);
    const elapsed = Date.now() - startTime;

    console.log(`[Insights] ✓ Generated in ${elapsed}ms`);
    console.log(`[Insights] Summary: ${parsed.summary?.length || 0} chars`);
    console.log(`[Insights] Chapters: ${parsed.chapters?.length || 0}`);
    console.log(`[Insights] Takeaways: ${parsed.key_takeaways?.length || 0}`);

    return {
      model: 'gemini-2.5-flash',
      summary: parsed.summary || '',
      chapters: parsed.chapters || [],
      key_takeaways: parsed.key_takeaways || [],
      seo_metadata: parsed.seo_metadata || {
        tags: [],
        suggested_titles: [],
        description: '',
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Insights] Gemini error:', msg);
    throw new Error(`Gemini AI generation failed: ${msg}`);
  }
}

function buildIntelligentPrompt(
  transcript: string,
  language: string,
  difficulty: string,
  contentCategory: 'short' | 'medium' | 'long',
  wordCount: number,
): string {
  const difficultyGuides: Record<string, string> = {
    beginner:
      'Use accessible language. Define technical terms. Explain concepts as if to someone new to the topic.',
    standard:
      'Balance clarity with precision. Briefly explain specialized terminology when it appears.',
    advanced:
      'Use precise technical language. Assume domain expertise. Focus on nuanced insights.',
  };

  const chapterGuidelines: Record<string, string> = {
    short: `
CHAPTER GUIDELINES (Short Content ~${wordCount} words):
- This is SHORT content. You may include 0-2 chapters ONLY if there are truly distinct topic shifts.
- If the content flows as one cohesive piece, return an EMPTY chapters array [].
- Do NOT force chapters where they don't naturally exist.
- Focus your effort on the summary and key takeaways instead.`,

    medium: `
CHAPTER GUIDELINES (Medium Content ~${wordCount} words):
- Create 3-6 chapters based on natural topic transitions.
- Each chapter should represent a meaningful segment (2-5 minutes of content).
- Chapter descriptions must be 2-3 sentences explaining the key points covered.
- Timestamps should be estimated based on position in transcript (assume ~150 words/minute).`,

    long: `
CHAPTER GUIDELINES (Long Content ~${wordCount} words):
- Create 6-12 chapters for comprehensive navigation.
- Each major topic shift should have its own chapter.
- Chapter descriptions should be 3-4 sentences with substantive detail.
- Consider sub-topics and transitions between major themes.
- Timestamps estimated at ~150 words/minute speaking rate.`,
  };

  const summaryGuidelines: Record<string, string> = {
    short: `
SUMMARY GUIDELINES (Short Content):
- Write 2-3 substantial paragraphs (200-400 words total).
- First paragraph: What is this content about? What's the main message?
- Second paragraph: Key arguments, evidence, or points made.
- Third paragraph (if needed): Conclusions, implications, or call to action.
- This IS the primary analysis since chapters may be minimal or absent.`,

    medium: `
SUMMARY GUIDELINES (Medium Content):
- Write 3-4 paragraphs (300-500 words total).
- Opening paragraph: Overview of the topic and why it matters.
- Middle paragraphs: Synthesize the major themes and arguments presented.
- Closing paragraph: Key conclusions and takeaways for the audience.
- The summary should stand alone as a comprehensive overview.`,

    long: `
SUMMARY GUIDELINES (Long Content):
- Write 4-5 paragraphs (400-700 words total).
- Opening: Set context and introduce the scope of content covered.
- Body paragraphs: Cover each major theme discussed, highlighting key insights.
- Penultimate paragraph: How the themes connect and build on each other.
- Closing: Overall conclusions, significance, and value for the audience.
- This should be thorough enough that someone could understand the full content.`,
  };

  return `You are an expert content analyst creating professional, publication-ready analysis.

TASK: Analyze this transcript and produce structured insights.

OUTPUT LANGUAGE: All text must be in ${language}.
AUDIENCE LEVEL: ${difficulty} — ${difficultyGuides[difficulty] || difficultyGuides.standard}

${chapterGuidelines[contentCategory]}

${summaryGuidelines[contentCategory]}

KEY TAKEAWAYS GUIDELINES:
- Extract 3-5 genuinely valuable, actionable insights.
- Each takeaway should be a complete thought (15-30 words).
- Focus on insights that provide real value, not obvious observations.
- Prioritize practical applications and unique perspectives.

SEO METADATA GUIDELINES:
- Tags: 8-15 relevant keywords covering topics, themes, and related concepts.
- Suggested Titles: 2-3 alternatives that are engaging AND accurate.
- Description: Exactly 150-160 characters, compelling hook for search results.

CRITICAL RULES:
1. Your ENTIRE response must be valid JSON matching the schema.
2. NO markdown, NO preamble, NO "Here is..." text.
3. Summaries must be SUBSTANTIAL — never just 1-2 sentences.
4. Chapter descriptions must be informative, not vague.
5. Quality over quantity for all fields.

TRANSCRIPT TO ANALYZE:
"""
${transcript.substring(0, 45000)}
"""`;
}
