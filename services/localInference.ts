/**
 * @file services/localInference.ts
 * @description Native Llama.rn Bridge & Hardware Watchdog
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - 128K CONTEXT UNLOCKED: Aligned ABSOLUTE_MAX_HARDWARE_CONTEXT to 131072.
 * - VULKAN CRASH PREVENTION: Context size is strictly capped at the prefill slider.
 * - HARDWARE SAFETY: Implements safety delays for Vulkan and hardware init.
 * - DECOUPLED ARCHITECTURE: Contains standalone prompt builder to prevent 
 *   Metro Bundler from crashing on Deno Edge Function dependencies.
 * - APRIL UPDATES: Flash Attention & Q8_0 KV Cache forced for 15k+ token stability.
 * ----------------------------------------------------------------------------
 */

import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AVAILABLE_MODELS } from '../constants/models';

// --- TYPES & INTERFACES ------------------------------------------------------

interface LlamaCompletionParams {
    prompt: string;
    n_predict: number;
    temperature: number;
    top_k: number;
    top_p: number;
    stop?: string[];
}

interface LlamaTokenData {
    token: string;
}

interface LlamaInstance {
    completion: (
        params: LlamaCompletionParams,
        onToken: (data: LlamaTokenData) => void
    ) => Promise<void>;
    stopCompletion?: () => Promise<void>;
    release: () => Promise<void>;
}

type InitLlamaFn = (options: {
    contextSize: number;
    model: string;
    n_gpu_layers: number;
    flash_attn?: boolean;
    cache_type_k?: string;
    cache_type_v?: string;
}) => Promise<LlamaInstance>;

// --- CONSTANTS ---------------------------------------------------------------

const ABSOLUTE_MAX_HARDWARE_CONTEXT = 131072; // 128K Web
const APK_SAFETY_CLAMP = 65536;               // 64K Android
const TOKEN_ESTIMATION_FACTOR = 3.2;
const TOKEN_BUFFER = 100;

// --- NATIVE MODULE INITIALIZATION --------------------------------------------

let initLlama: InitLlamaFn | null = null;

if (Platform.OS !== 'web') {
    try {
        const llamaModule = require('llama.rn');
        initLlama = llamaModule.initLlama;
    } catch (e) {
        console.warn("[VeraxAI] Native llama.rn module not found.");
    }
}

// --- ENGINE STATE MANAGEMENT -------------------------------------------------

interface EngineState {
    context: LlamaInstance | null;
    modelId: string | null;
    contextSize: number;
}

const engineState: EngineState = {
    context: null,
    modelId: null,
    contextSize: 0,
};

// --- PROMPT TEMPLATES (APRIL 30TH STANDARD) ----------------------------------

const TEMPLATES = {
    gemma4: {
        // STRICT: Zero-BOS. Starts with <start_of_turn>user\n and ends with <start_of_turn>model\n{
        json: (prompt: string) => `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n{`,

        // STRICT: Zero-BOS conversational format
        chat: (messages: { role: 'user' | 'ai'; content: string }[]) => {
            let prompt = "";
            for (const msg of messages) {
                const role = msg.role === 'ai' ? 'model' : 'user';
                prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
            }
            prompt += "<start_of_turn>model\n";
            return prompt;
        },

        // STRICT: Terminal tags only. Removes raw "user" and "model".
        stop: ["<end_of_turn>", "<eos>", "<start_of_turn>"]
    }
};

// --- CLIENT-SIDE PROMPT ENGINE (DECOUPLED FROM SUPABASE) ---------------------

function getContentCategory(transcript: string): 'short' | 'medium' | 'long' {
    const wordCount = transcript.split(/\s+/).length;
    if (wordCount < 1000) return 'short';
    if (wordCount < 5000) return 'medium';
    return 'long';
}

function buildPrompt(transcript: string, language: string, difficulty: string, category: 'short' | 'medium' | 'long'): string {
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

export function buildAgentPrompt(transcript: string, language: string, difficulty: string) {
    const category = getContentCategory(transcript);
    const fullPrompt = buildPrompt(transcript, language, difficulty, category);

    const splitIndex = fullPrompt.indexOf('VERBATIM TRANSCRIPT:');

    if (splitIndex !== -1) {
        const systemInstruction = fullPrompt.substring(0, splitIndex).trim();
        const userMessage = fullPrompt.substring(splitIndex).trim();
        return { systemInstruction, userMessage };
    }

    return {
        systemInstruction: "You are VeraxAI's elite Senior Intelligence Analyst. Produce flawless JSON insights.",
        userMessage: fullPrompt
    };
}

// --- UTILITIES ---------------------------------------------------------------

const estimateTokens = (text: string, buffer: number = 0): number => {
    return Math.ceil(text.length / TOKEN_ESTIMATION_FACTOR) + buffer;
};

const getModelConfig = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
};

const extractCleanJson = (text: string): string => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end >= start) {
        return text.substring(start, end + 1);
    }
    return text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim() || "{}";
};

const executeNativeCompletion = async (
    context: LlamaInstance,
    params: LlamaCompletionParams,
    initialText: string = "",
    onChunk?: (token: string) => void
): Promise<string> => {
    let fullText = initialText;

    await context.completion(params, (data) => {
        fullText += data.token;
        if (onChunk) onChunk(data.token);
    });

    return fullText;
};

// --- ENGINE MANAGEMENT -------------------------------------------------------

export const releaseNativeEngine = async () => {
    if (engineState.context && Platform.OS !== 'web') {
        console.log(`[Local AI] Releasing hardware context. Freeing RAM...`);
        try {
            await engineState.context.release();
        } catch (e) {
            console.error("[Local AI] Failed to release context.", e);
        } finally {
            engineState.context = null;
            engineState.modelId = null;
            engineState.contextSize = 0;
        }
    }
};

export const abortNativeInference = async () => {
    if (engineState.context && Platform.OS !== 'web') {
        console.log(`[Local AI] Aborting active inference...`);
        try {
            if (typeof engineState.context.stopCompletion === 'function') {
                await engineState.context.stopCompletion();
            } else {
                await releaseNativeEngine();
            }
        } catch (e) {
            console.error("[Local AI] Failed to abort inference.", e);
        }
    }
};

export const configureNativeEngine = async (
    modelId: string,
    options: { prefillTokens: number; gpuLayers: number }
) => {
    let targetContext = Platform.OS === 'web'
        ? ABSOLUTE_MAX_HARDWARE_CONTEXT
        : Math.min(options.prefillTokens, APK_SAFETY_CLAMP);

    const optimalContext = Math.floor(targetContext / 256) * 256;

    const isMatch =
        engineState.context &&
        engineState.modelId === modelId &&
        engineState.contextSize === optimalContext;

    if (isMatch) return;

    console.log(`[Local AI] Reconfiguring engine...`);
    await releaseNativeEngine();

    if (!initLlama) {
        throw new Error("LLAMA_NATIVE_MISSING: Native module not initialized.");
    }

    const FileSystem = require('expo-file-system/legacy');
    const docDir = FileSystem.documentDirectory || 'file:///tmp/';
    const model = getModelConfig(modelId);
    const fileName = model.fileName;

    const fileUri = `${docDir}${fileName}`;
    const modelPath = fileUri.replace('file://', '');

    try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
            throw new Error(`MODEL_FILE_NOT_FOUND: ${fileName} is missing from storage.`);
        }
    } catch (e: any) {
        console.error("[Local AI] File system check failed:", e.message);
        throw e;
    }

    console.log(`[Local AI] Booting engine | Model: ${modelId} | Context: ${optimalContext} | GPU Layers: ${options.gpuLayers}`);

    try {
        engineState.context = await initLlama({
            contextSize: optimalContext,
            model: modelPath,
            n_gpu_layers: options.gpuLayers,
            flash_attn: true, // Critical for 15k+ token context window on mobile
            cache_type_k: 'q8_0', // Compress KV memory to prevent OOM crashes
            cache_type_v: 'q8_0',
        });

        engineState.modelId = modelId;
        engineState.contextSize = optimalContext;
        console.log(`[Local AI] Engine booted successfully.`);
    } catch (e: any) {
        console.error("[Local AI] Failed to boot native engine:", e.message);
        throw new Error(`ENGINE_BOOT_FAILED: ${e.message}`);
    }
};

// --- INFERENCE ENGINES -------------------------------------------------------

export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, prefillTokens, decodeTokens, gpuLayers, port, temperature } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model selected.");

    if (Platform.OS === 'web') {
        return runWebProxyInference(prompt, activeModelId, port || "1234", decodeTokens || 2048, temperature || 0.15);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    await activateKeepAwakeAsync();

    try {
        const model = getModelConfig(activeModelId);
        const template = TEMPLATES[model.architecture as keyof typeof TEMPLATES] || TEMPLATES.gemma4;

        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English", "standard");
        const combinedPrompt = `${systemInstruction}\n\n${userMessage}`;

        const formattedPrompt = template.json(combinedPrompt);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        if (estimatedPromptTokens >= prefillTokens) {
            throw new Error(`CONTEXT_OVERFLOW_SLIDER: Prompt exceeds prefill limit.`);
        }

        await configureNativeEngine(activeModelId, { prefillTokens, gpuLayers });

        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 20) {
            throw new Error("CONTEXT_OVERFLOW_SLIDER: Insufficient space for output.");
        }

        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

        const result = await executeNativeCompletion(
            engineState.context,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: 0.15, // Force strict JSON determinism
                top_k: 40,
                top_p: 0.95,
                stop: template.stop
            },
            "",
            onChunk
        );

        return extractCleanJson(result.startsWith('{') ? result : '{' + result);
    } catch (e: any) {
        console.error("[Local Inference Error]", e);
        throw e;
    } finally {
        deactivateKeepAwake();
    }
};

export const runLocalChatInference = async (
    messages: { role: 'user' | 'ai'; content: string }[],
    onChunk?: (token: string) => void
): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, temperature, prefillTokens, decodeTokens, gpuLayers } = state;

    if (!activeModelId) throw new Error("FAULT: No model selected.");

    await activateKeepAwakeAsync();
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const template = TEMPLATES.gemma4;
        const formattedPrompt = template.chat(messages);

        await configureNativeEngine(activeModelId, { prefillTokens, gpuLayers });

        const estimatedPromptTokens = estimateTokens(formattedPrompt);
        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);

        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

        return await executeNativeCompletion(
            engineState.context,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: Math.max(0.65, temperature), // Allow creativity in Sandbox
                top_k: 40,
                top_p: 0.9,
                stop: template.stop
            },
            "",
            onChunk
        );
    } catch (e: any) {
        console.error("[Local Chat Error]", e);
        throw e;
    } finally {
        deactivateKeepAwake();
    }
};

/**
 * WEB GATEWAY (Vercel Proxy / LM Studio)
 */
async function runWebProxyInference(prompt: string, modelId: string, port: string, maxTokens: number, temperature: number): Promise<string> {
    const endpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature,
                max_tokens: maxTokens,
                stream: false,
            }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`WEB_PROXY_ERROR: HTTP ${response.status}`);

        const json = await response.json();
        return extractCleanJson(json.choices?.[0]?.message?.content || "{}");

    } catch (e: any) {
        throw new Error(`GATEWAY_UNREACHABLE: Failed to connect to local runner on port ${port}.`);
    }
}