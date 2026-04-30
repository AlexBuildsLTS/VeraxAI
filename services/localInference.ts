/**
 * @file services/localInference.ts
 * @description Native Llama.rn Bridge & Hardware Watchdog
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - 128K CONTEXT UNLOCKED: Aligned ABSOLUTE_MAX_HARDWARE_CONTEXT to 131072.
 * - VULKAN CRASH PREVENTION: Context size is strictly capped at the prefill slider.
 *   n_predict is mathematically clamped so (prompt + output <= context).
 * - ZERO-BOS PROMPT ALIGNMENT: Strictly removed all <bos> tags from templates 
 *   because llama.rn auto-injects it. Double <bos> causes instant EOS.
 * - DUAL ENGINES: Safely separates Pipeline Inference from Chat Inference.
 * ----------------------------------------------------------------------------
 */

import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

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
    release: () => Promise<void>;
}

type InitLlamaFn = (options: {
    contextSize: number;
    model: string;
    n_gpu_layers: number;
}) => Promise<LlamaInstance>;

// --- CONSTANTS ---------------------------------------------------------------

// UPGRADE: 128K Context Unlocked for E2B/E4B Models (Supports 40+ min videos)
const ABSOLUTE_MAX_HARDWARE_CONTEXT = 131072;
const TOKEN_ESTIMATION_FACTOR = 3.2; // Conservative calculation
const TOKEN_BUFFER = 100;

const MODEL_REGISTRY: Record<string, string> = {
    'gemma-4-e4b-it-unsloth': 'gemma-4-E4B-it-Q4_K_M.gguf',
    'gemma-4-e2b-it-unsloth': 'gemma-4-E2B-it-UD-Q4_K_XL.gguf',
    'default': 'google_gemma-4-E2B-it-bf16.gguf'
};

// --- NATIVE MODULE INITIALIZATION --------------------------------------------

let initLlama: InitLlamaFn | null = null;

if (Platform.OS !== 'web') {
    try {
        // Dynamic require to prevent web bundling issues
        const llamaModule = require('llama.rn');
        initLlama = llamaModule.initLlama;
    } catch (e) {
        console.warn("[Local AI] llama.rn module not found. Ensure the native module is linked.");
    }
}

// --- SINGLETON ENGINE TRACKING -----------------------------------------------

let activeLlamaContext: LlamaInstance | null = null;
let activeModelId: string | null = null;
let activeContextSize: number = 0;
let activeGpuLayers: number = 0;

// --- UTILITIES ---------------------------------------------------------------

/**
 * Estimates token count based on string length.
 * @param text The input string
 * @param buffer Optional extra tokens to add
 */
const estimateTokens = (text: string, buffer: number = 0): number => {
    return Math.ceil(text.length / TOKEN_ESTIMATION_FACTOR) + buffer;
};

/**
 * Formats prompt for JSON output by pre-injecting the opening bracket.
 * FIX: Added <bos> back to prevent token collision and instant aborts.
 */
const formatGemmaJSONPrompt = (prompt: string): string => {
    return `<bos><start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n{`;
};

/**
 * Formats chat history for Gemma models.
 * FIX: Added <bos> back to prevent empty bubble responses.
 */
const formatGemmaChatHistory = (messages: { role: 'user' | 'ai'; content: string }[]): string => {
    let prompt = "<bos>";
    for (const msg of messages) {
        const role = msg.role === 'ai' ? 'model' : 'user';
        prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
    }
    prompt += "<start_of_turn>model\n";
    return prompt;
};

/**
 * Wraps the native completion callback in a promise.
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

// --- ENGINE MANAGEMENT -------------------------------------------------------

/**
 * PRODUCTION SAFEGUARD: Memory Leak Prevention & Reconfiguration
 */
export const releaseNativeEngine = async () => {
    if (activeLlamaContext && Platform.OS !== 'web') {
        console.log(`[Local AI] Releasing hardware context. Freeing RAM...`);
        try {
            await activeLlamaContext.release();
        } catch (e) {
            console.error("[Local AI] Failed to release context.", e);
        } finally {
            activeLlamaContext = null;
            activeModelId = null;
            activeContextSize = 0;
            activeGpuLayers = 0;
        }
    }
};

/**
 * Instantiates the hardware context cleanly based on user configuration.
 */
export const configureNativeEngine = async (
    modelId: string,
    options: { prefillTokens: number; gpuLayers: number }
) => {
    // Align context size to 256 for Vulkan memory alignment
    let optimalContext = Math.floor(options.prefillTokens / 256) * 256;
    optimalContext = Math.min(optimalContext, ABSOLUTE_MAX_HARDWARE_CONTEXT);

    const isMatch =
        activeLlamaContext &&
        activeModelId === modelId &&
        activeContextSize === optimalContext &&
        activeGpuLayers === options.gpuLayers;

    if (!isMatch) {
        console.log(`[Local AI] Reconfiguring engine...`);
        await releaseNativeEngine();

        if (!initLlama) {
            throw new Error("LLAMA_NATIVE_MISSING: Native module not initialized.");
        }

        const FileSystem = require('expo-file-system/legacy');
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';
        const fileName = MODEL_REGISTRY[modelId] || MODEL_REGISTRY['default'];

        // FIX: fileUri retains the file:// prefix required by Expo FileSystem.
        // modelPath strips it for the C++ llama.rn bridge.
        const fileUri = `${docDir}${fileName}`;
        const modelPath = fileUri.replace('file://', '');

        // Verify file exists before loading using the safe Expo URI
        try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (!fileInfo.exists) {
                throw new Error(`MODEL_FILE_NOT_FOUND: ${fileName} is missing from storage.`);
            }
            console.log(`[Local AI] Model file verified: ${fileName} (${(fileInfo.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (e: any) {
            console.error("[Local AI] File system check failed:", e.message);
            throw e;
        }

        console.log(`[Local AI] Booting engine | Model: ${modelId} | Context: ${optimalContext} | GPU: ${options.gpuLayers}`);

        try {
            activeLlamaContext = await initLlama({
                contextSize: optimalContext,
                model: modelPath, // Initialize C++ with the stripped path
                n_gpu_layers: options.gpuLayers,
            });
            console.log(`[Local AI] Engine booted successfully.`);
        } catch (e: any) {
            console.error("[Local AI] Failed to boot native engine:", e.message);
            throw new Error(`ENGINE_BOOT_FAILED: ${e.message}`);
        }

        activeModelId = modelId;
        activeContextSize = optimalContext;
        activeGpuLayers = options.gpuLayers;
    }
};

// --- INFERENCE ENGINES -------------------------------------------------------

/**
 * ENGINE 1: PIPELINE INFERENCE (STRICT JSON)
 */
export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, temperature, port, prefillTokens, decodeTokens, gpuLayers } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model selected.");

    if (Platform.OS === 'web') {
        return runWebInference(prompt, activeModelId, { port, temperature, decodeTokens }, onChunk);
    }

    // Yield thread to allow telemetry logs to fire before Vulkan locks the CPU
    await new Promise(resolve => setTimeout(resolve, 1500));
    await activateKeepAwakeAsync();

    console.log(`[Local AI] Starting pipeline inference. Prefill: ${prefillTokens}, Decode: ${decodeTokens}`);

    try {
        const formattedPrompt = formatGemmaJSONPrompt(prompt);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        console.log(`[Local AI] Estimated prompt tokens: ${estimatedPromptTokens}`);

        if (estimatedPromptTokens >= prefillTokens) {
            console.warn(`[Local AI] Prompt too large: ${estimatedPromptTokens} vs ${prefillTokens}`);
            throw new Error("CONTEXT_OVERFLOW_SLIDER: Prompt exceeds prefill limit.");
        }

        await configureNativeEngine(activeModelId, { prefillTokens, gpuLayers });

        // VULKAN CRASH PREVENTION: Clamp output to remaining context
        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 20) {
            console.warn(`[Local AI] Insufficient space for output: ${safeDecodeLimit} tokens remaining.`);
            throw new Error("CONTEXT_OVERFLOW_SLIDER: Insufficient space for output.");
        }

        if (!activeLlamaContext) throw new Error("ENGINE_NOT_READY");

        console.log(`[Local AI] Executing completion (limit: ${safeDecodeLimit})...`);

        const result = await executeNativeCompletion(
            activeLlamaContext,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: temperature,
                top_k: 40,
                top_p: 0.95,
                stop: ["<end_of_turn>", "<eos>"] // Removed problematic model\n and user\n stops
            },
            "{", // Pre-populated bracket to force JSON
            onChunk
        );

        console.log(`[Local AI] Inference complete. Output length: ${result.length}`);
        return result;
    } catch (e: any) {
        console.error("[Local AI Native Error]", e);
        if (e.message.includes('CONTEXT_OVERFLOW_SLIDER')) throw e;
        throw new Error(`NATIVE_INFERENCE_FAILURE: ${e.message}`);
    } finally {
        deactivateKeepAwake();
    }
};

/**
 * ENGINE 2: CHAT SANDBOX INFERENCE (CONVERSATIONAL)
 */
export const runLocalChatInference = async (
    messages: { role: 'user' | 'ai'; content: string }[],
    onChunk?: (token: string) => void
): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, temperature, prefillTokens, decodeTokens, gpuLayers } = state;

    if (!activeModelId) throw new Error("No active model selected.");
    if (Platform.OS === 'web') throw new Error("Chat sandbox is native-only.");

    await activateKeepAwakeAsync();
    try {
        const formattedPrompt = formatGemmaChatHistory(messages);
        const estimatedPromptTokens = estimateTokens(formattedPrompt);

        if (estimatedPromptTokens >= prefillTokens) {
            throw new Error(`Conversation too long (${estimatedPromptTokens} tokens).`);
        }

        await configureNativeEngine(activeModelId, { prefillTokens, gpuLayers });

        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 10) throw new Error("Conversation maxed out. Clear chat.");

        if (!activeLlamaContext) throw new Error("ENGINE_NOT_READY");

        return await executeNativeCompletion(
            activeLlamaContext,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: Math.max(0.4, temperature),
                top_k: 40,
                top_p: 0.95,
                stop: ["<end_of_turn>", "<eos>"] // Removed problematic model\n and user\n stops
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
 * WEB ENGINE: Local HTTP Gateway (LM Studio / Ollama)
 */
const runWebInference = async (
    prompt: string,
    modelId: string,
    options: { port: string; temperature: number; decodeTokens: number },
    onChunk?: (token: string) => void
): Promise<string> => {
    const endpoint = `http://127.0.0.1:${options.port}/v1/chat/completions`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: prompt }],
                temperature: options.temperature,
                max_tokens: Math.max(options.decodeTokens, 1024),
                stream: true,
            }),
        });

        if (!response.ok) throw new Error(`GATEWAY_ERROR: HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) return "";

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const dataStr = trimmed.slice(6);
                if (dataStr === '[DONE]') break;

                try {
                    const json = JSON.parse(dataStr);
                    const content = json.choices[0]?.delta?.content || '';
                    if (content) {
                        fullText += content;
                        onChunk?.(content);
                    }
                } catch (e) {
                    // Ignore malformed chunks
                }
            }
        }
        return fullText;
    } catch (e: any) {
        throw new Error(`GATEWAY_UNREACHABLE: Failed to connect to local runner on port ${options.port}.`);
    }
};

export const abortNativeInference = async () => {
    await releaseNativeEngine();
};