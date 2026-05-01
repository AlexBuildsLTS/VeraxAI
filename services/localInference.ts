/**
 * @file services/localInference.ts
 * @description Master Native Llama.rn Bridge & Hardware Watchdog
 * ----------------------------------------------------------------------------
 * VERSION: 4.2.1 (Post-April 2026 Hardware Update)
 * ARCHITECTURE: Dynamic Hardware Scaling for Gemma-4 Architecture
 * 
 * DESIGN PRINCIPLES:
 * 1. ZERO-BOS TOKENIZATION: Complies with April 21st llama.cpp engine logic
 *    which auto-injects BOS tokens for Gemma. Prevents turn-0 stalling.
 * 2. VRAM FENCING: Strict 16K limit on mobile Vulkan to prevent memory 
 *    segmentation faults while allowing 128K context on high-end desktop web.
 * 3. DECOUPLED ARCHITECTURE: Standalone prompt builder avoids Deno/Edge 
 *    circular dependencies during Metro bundling.
 * 4. SYNC-FLUSH: Ensures KV Cache is fully purged before hardware reallocation.
 * ----------------------------------------------------------------------------
 */

import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AVAILABLE_MODELS } from '../constants/models';

/**
 * NATIVE BRIDGE TYPE DEFINITIONS
 * ----------------------------------------------------------------------------
 * These interfaces map directly to the llama.rn native implementation
 * requirements for JSI communication.
 */

export interface LlamaCompletionParams {
    prompt: string;
    n_predict: number;
    temperature: number;
    top_k: number;
    top_p: number;
    stop?: string[];
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    mirostat?: number;
    mirostat_tau?: number;
    mirostat_eta?: number;
}

export interface LlamaTokenData {
    token: string;
    completion_probabilities?: Array<{
        token: string;
        probs: number;
    }>;
}

export interface LlamaInstance {
    /**
     * Executes raw inference on the native engine.
     * Tokens are streamed back in real-time via the onToken callback.
     */
    completion: (
        params: LlamaCompletionParams,
        onToken: (data: LlamaTokenData) => void
    ) => Promise<void>;

    /**
     * Instantly halts token generation without releasing VRAM.
     */
    stopCompletion?: () => Promise<void>;

    /**
     * Completely releases the model and flushes VRAM/RAM back to the OS.
     * Required before initializing a new model or context size.
     */
    release: () => Promise<void>;

    /**
     * Tokenizes text into a raw integer array for precise context measurement.
     */
    tokenize: (text: string) => Promise<number[]>;
}

/**
 * Initialization function provided by the llama.rn native module.
 */
type InitLlamaFn = (options: {
    contextSize: number;
    model: string;
    n_gpu_layers: number;
    flash_attn?: boolean;
    cache_type_k?: 'f16' | 'q8_0' | 'q4_0';
    cache_type_v?: 'f16' | 'q8_0' | 'q4_0';
    threads?: number;
    use_mmap?: boolean;
    use_mlock?: boolean;
}) => Promise<LlamaInstance>;

/**
 * HARDWARE FENCING CONSTANTS
 */
const ABSOLUTE_MAX_HARDWARE_CONTEXT = 131072; // 128K context for Web/Desktop
const MOBILE_VRAM_SAFE_LIMIT = 16384;        // Strict 16K safety clamp for Android/iOS
const TOKEN_ESTIMATION_FACTOR = 3.2;         // Precision factor for English/JSON
const WATCHDOG_BUFFER = 150;                 // Token safety padding for system instructions

/**
 * ENGINE INITIALIZATION BRIDGE
 */
let initLlama: InitLlamaFn | null = null;
const OS_TARGET = String(Platform.OS);

if (OS_TARGET !== 'web') {
    try {
        // Dynamic require ensures the Metro bundler does not include 
        // native modules in web target builds, preventing compilation failure.
        const llamaModule = require('llama.rn');
        initLlama = llamaModule.initLlama;
    } catch (e) {
        console.warn("[VeraxAI] Native Llama.rn bridge not found. Engine defaulting to Web Gateway.");
    }
}

/**
 * INTERNAL ENGINE STATE SINGLETON
 * ----------------------------------------------------------------------------
 * Tracks the active native context to prevent multiple hardware allocations.
 */
interface EngineState {
    context: LlamaInstance | null;
    modelId: string | null;
    contextSize: number;
    gpuLayers: number;
    isInitializing: boolean;
}

const engineState: EngineState = {
    context: null,
    modelId: null,
    contextSize: 0,
    gpuLayers: 0,
    isInitializing: false,
};

/**
 * GEMMA-4 ARCHITECTURE TEMPLATES (ZERO-BOS TURN-0)
 * ----------------------------------------------------------------------------
 * As of the April 22nd engine updates, llama.cpp handles BOS injection.
 * Manual injection of <start_of_turn> at index 0 causes turn-0 model stalls.
 */
const TEMPLATES = {
    gemma4: {
        /**
         * System-Instruction leading format for automated JSON generation.
         */
        json: (prompt: string) => `user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`,

        /**
         * Conversational chat format. Omits turn-0 BOS for engine compliance.
         */
        chat: (messages: { role: 'user' | 'ai'; content: string }[]) => {
            let prompt = "";
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const role = msg.role === 'ai' ? 'model' : 'user';

                if (i === 0) {
                    // ZERO-BOS Logic for the initial sequence
                    prompt += `${role}\n${msg.content}<end_of_turn>\n`;
                } else {
                    prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
                }
            }
            prompt += "<start_of_turn>model\n";
            return prompt;
        },

        stop: ["<end_of_turn>", "<eos>", "<start_of_turn>", "model\n"]
    }
};

/**
 * ANALYTICS & PROMPT CONSTRUCTORS
 */

function getContentCategory(transcript: string): 'short' | 'medium' | 'long' {
    const wordCount = transcript.split(/\s+/).length;
    if (wordCount < 1000) return 'short';
    if (wordCount < 5000) return 'medium';
    return 'long';
}

/**
 * Builds the high-fidelity prompt for executive dossier production.
 */
function buildPrompt(
    transcript: string,
    language: string,
    difficulty: string,
    category: 'short' | 'medium' | 'long'
): string {
    const difficultyGuides: Record<string, string> = {
        beginner: 'Use highly accessible, clear language. Define complex terminology simply. Focus on clarity.',
        standard: 'Maintain a pristine, professional executive tone. Balance analytical depth with readability.',
        advanced: 'Assume elite domain expertise. Use precise technical, academic, or industry-standard terminology.',
    };

    const depthGuide = {
        short: 'Concentrated 2-paragraph summary. Exactly 1 to 3 distinct chapters.',
        medium: 'Elite 3-4 paragraph executive summary. Exactly 3 to 6 detailed chapters.',
        long: 'Massive, profound 4-6 paragraph executive dossier. Exactly 5 to 8 major chronological chapters.',
    }[category];

    return `You are VeraxAI's elite Senior Intelligence Analyst. Produce a flawless, publication-ready dossier.

TASK: Analyze the verbatim transcript below to produce perfectly structured insights.

TARGET OUTPUT LANGUAGE: ${language.toUpperCase()}
AUDIENCE CALIBRATION: ${difficulty} — ${difficultyGuides[difficulty] ?? difficultyGuides.standard}

STRICT TRANSLATION PROTOCOL:
1. JSON keys ("summary", "conclusion", "chapters", "title") MUST remain in English.
2. ALL string values INSIDE the JSON MUST be translated into ${language.toUpperCase()} with native fluency.

FORMATTING:
- Use rich Markdown formatting (bolding) inside JSON strings.
- ${depthGuide}

RULES:
1. OUTPUT ONLY VALID JSON. No conversational preamble.
2. Output MUST begin with '{' and end with '}'.
3. Extract data strictly from provided text. Zero hallucinations.

VERBATIM TRANSCRIPT:
"""
${transcript}
"""`;
}

/**
 * Wraps prompt construction and splits system instructions for agent consumption.
 */
export function buildAgentPrompt(transcript: string, language: string, difficulty: string) {
    const category = getContentCategory(transcript);
    const fullPrompt = buildPrompt(transcript, language, difficulty, category);

    const splitIndex = fullPrompt.indexOf('VERBATIM TRANSCRIPT:');

    if (splitIndex !== -1) {
        return {
            systemInstruction: fullPrompt.substring(0, splitIndex).trim(),
            userMessage: fullPrompt.substring(splitIndex).trim()
        };
    }

    return {
        systemInstruction: "You are VeraxAI's elite Analyst. Produce flawless JSON insights.",
        userMessage: fullPrompt
    };
}

/**
 * HARDWARE UTILITIES
 */

const estimateTokens = (text: string, buffer: number = 0): number => {
    return Math.ceil(text.length / TOKEN_ESTIMATION_FACTOR) + buffer;
};

const getModelConfig = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
};

/**
 * Aggressive JSON Stripper
 * Removes markdown block syntax and isolates the core JSON structure.
 */
const extractCleanJson = (text: string): string => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end >= start) {
        return text.substring(start, end + 1);
    }

    // Fallback if model omitted braces
    let cleaned = text.trim();
    const jsonMatch = "```json";
    const backticks = "```";

    if (cleaned.toLowerCase().startsWith(jsonMatch)) {
        cleaned = cleaned.substring(jsonMatch.length);
    } else if (cleaned.startsWith(backticks)) {
        cleaned = cleaned.substring(backticks.length);
    }

    if (cleaned.endsWith(backticks)) {
        cleaned = cleaned.substring(0, cleaned.length - backticks.length);
    }

    return cleaned.trim() || "{}";
};

/**
 * Internal loop for native token stream handling.
 */
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

/**
 * ENGINE LIFECYCLE CONTROLLERS
 */

/**
 * Flushes the hardware context. Mandatory before any parameter reconfiguration.
 */
export const releaseNativeEngine = async () => {
    if (engineState.context && OS_TARGET !== 'web') {
        console.log(`[Local AI] Flushing KV Cache and releasing VRAM...`);
        try {
            await engineState.context.release();
        } catch (e) {
            console.error("[Local AI] Failed to release hardware context:", e);
        } finally {
            engineState.context = null;
            engineState.modelId = null;
            engineState.contextSize = 0;
            engineState.gpuLayers = 0;
        }
    }
};

/**
 * Aborts the current inference stream without losing the loaded model.
 */
export const abortNativeInference = async () => {
    if (engineState.context && OS_TARGET !== 'web') {
        console.log(`[Local AI] Interrupting hardware inference stream...`);
        try {
            if (typeof engineState.context.stopCompletion === 'function') {
                await engineState.context.stopCompletion();
            } else {
                await releaseNativeEngine();
            }
        } catch (e) {
            console.error("[Local AI] Abort fault:", e);
        }
    }
};

/**
 * Configures the native bridge for the target hardware environment.
 * Implements per-device context clamping and KV-cache quantization.
 */
export const configureNativeEngine = async (
    modelId: string,
    options: { prefillTokens: number; gpuLayers: number }
) => {
    if (engineState.isInitializing) return;

    // HARDWARE FENCING: Apply safety clamp for mobile environments
    let targetContext = OS_TARGET === 'web'
        ? ABSOLUTE_MAX_HARDWARE_CONTEXT
        : Math.min(options.prefillTokens, MOBILE_VRAM_SAFE_LIMIT);

    // Context Alignment for memory page optimization
    const optimalContext = Math.floor(targetContext / 256) * 256;

    const isMatch =
        engineState.context &&
        engineState.modelId === modelId &&
        engineState.contextSize === optimalContext &&
        engineState.gpuLayers === options.gpuLayers;

    if (isMatch) return;

    engineState.isInitializing = true;
    console.log(`[Local AI] Re-Syncing hardware state for ${modelId}...`);

    await releaseNativeEngine();

    if (!initLlama) {
        engineState.isInitializing = false;
        throw new Error("NATIVE_LLAMA_MISSING: Hardware module not initialized.");
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
            engineState.isInitializing = false;
            throw new Error(`MODEL_NOT_FOUND: ${fileName} is missing from device storage.`);
        }
    } catch (e: any) {
        engineState.isInitializing = false;
        throw e;
    }

    console.log(`[Local AI] Booting Engine | KV: q8_0 | Context: ${optimalContext} | GPU: ${options.gpuLayers}`);

    try {
        // VRAM optimized initialization
        engineState.context = await initLlama({
            contextSize: optimalContext,
            model: modelPath,
            n_gpu_layers: options.gpuLayers,
            flash_attn: true,
            cache_type_k: 'q8_0',
            cache_type_v: 'q8_0',
            use_mmap: true,
            threads: 8
        });

        engineState.modelId = modelId;
        engineState.contextSize = optimalContext;
        engineState.gpuLayers = options.gpuLayers;
        console.log(`[Local AI] Native Engine Online and Secure.`);
    } catch (e: any) {
        console.error("[Local AI] Failed to boot native engine:", e.message);
        throw new Error(`HARDWARE_BOOT_FAILED: ${e.message}`);
    } finally {
        engineState.isInitializing = false;
    }
};

/**
 * HIGH-THROUGHPUT INFERENCE ENGINES
 */

/**
 * Standard Inference for Transcript Analysis
 */
export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, prefillTokens, decodeTokens, gpuLayers, port, temperature } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model loaded.");

    // Redirect to Web Proxy if environment is browser-based
    if (OS_TARGET === 'web') {
        return runWebProxyInference(prompt, activeModelId, port || "1234", decodeTokens || 2048, temperature || 0.15);
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    await activateKeepAwakeAsync();

    try {
        const model = getModelConfig(activeModelId);
        const template = TEMPLATES[model.architecture as keyof typeof TEMPLATES] || TEMPLATES.gemma4;

        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English", "standard");
        const combinedPrompt = `${systemInstruction}\n\n${userMessage}`;

        const formattedPrompt = template.json(combinedPrompt);

        // WATCHDOG: Ensure we stay within hardware fence
        const safePrefillLimit = Math.min(prefillTokens, MOBILE_VRAM_SAFE_LIMIT);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, WATCHDOG_BUFFER);

        if (estimatedPromptTokens >= safePrefillLimit) {
            throw new Error(`CONTEXT_OVERFLOW: Input exceeds hardware safety fence.`);
        }

        await configureNativeEngine(activeModelId, { prefillTokens: safePrefillLimit, gpuLayers });

        const safeDecodeLimit = Math.min(decodeTokens, safePrefillLimit - estimatedPromptTokens);
        if (safeDecodeLimit <= 0) {
            throw new Error("CONTEXT_OVERFLOW: Insufficient space for generated output.");
        }

        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

        const result = await executeNativeCompletion(
            engineState.context,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: 0.15,
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

/**
 * Sequential Inference for Chat Sandbox
 */
export const runLocalChatInference = async (
    messages: { role: 'user' | 'ai'; content: string }[],
    onChunk?: (token: string) => void
): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, temperature, prefillTokens, decodeTokens, gpuLayers } = state;

    if (!activeModelId) throw new Error("FAULT: No hardware engine selected.");

    await activateKeepAwakeAsync();
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
        const template = TEMPLATES.gemma4;
        const formattedPrompt = template.chat(messages);

        const safePrefillLimit = OS_TARGET === 'web' ? prefillTokens : Math.min(prefillTokens, MOBILE_VRAM_SAFE_LIMIT);
        await configureNativeEngine(activeModelId, { prefillTokens: safePrefillLimit, gpuLayers });

        const estimatedPromptTokens = estimateTokens(formattedPrompt);
        const safeDecodeLimit = Math.min(decodeTokens, safePrefillLimit - estimatedPromptTokens);

        if (safeDecodeLimit <= 0) {
            throw new Error("Context limits reached. Please clear history to continue.");
        }

        if (!engineState.context) throw new Error("ENGINE_OFFLINE");

        return await executeNativeCompletion(
            engineState.context,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: Math.max(0.65, temperature),
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
 * WEB GATEWAY PROXY
 * ----------------------------------------------------------------------------
 * Connects to local development runners (LM Studio, Ollama) when in Web mode.
 */
async function runWebProxyInference(
    prompt: string,
    modelId: string,
    port: string,
    maxTokens: number,
    temperature: number
): Promise<string> {
    const endpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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
        throw new Error(`GATEWAY_UNREACHABLE: Ensure local runner is active on port ${port}.`);
    }
}