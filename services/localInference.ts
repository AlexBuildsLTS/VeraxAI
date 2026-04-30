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

const ABSOLUTE_MAX_HARDWARE_CONTEXT = 131072; // 128K Context Unlocked
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

const estimateTokens = (text: string, buffer: number = 0): number => {
    return Math.ceil(text.length / TOKEN_ESTIMATION_FACTOR) + buffer;
};

// NO <bos> - Prevents token collisions
const formatGemmaJSONPrompt = (prompt: string): string => {
    return `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n{`;
};

// NO <bos> - Prevents empty chat bubbles
const formatGemmaChatHistory = (messages: { role: 'user' | 'ai'; content: string }[]): string => {
    let prompt = "";
    for (const msg of messages) {
        const role = msg.role === 'ai' ? 'model' : 'user';
        prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
    }
    prompt += "<start_of_turn>model\n";
    return prompt;
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

export const configureNativeEngine = async (
    modelId: string,
    options: { prefillTokens: number; gpuLayers: number }
) => {
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
                model: modelPath,
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
 * ENGINE 1: PIPELINE INFERENCE (STRICT JSON TRANSCRIBER)
 */
export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, temperature, port, prefillTokens, decodeTokens, gpuLayers } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model selected.");

    if (Platform.OS === 'web') {
        return runWebInference(prompt, activeModelId, { port, temperature, decodeTokens }, onChunk);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    await activateKeepAwakeAsync();

    console.log(`[Local AI] Starting pipeline inference. Prefill: ${prefillTokens}, Decode: ${decodeTokens}`);

    try {
        const formattedPrompt = formatGemmaJSONPrompt(prompt);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        if (estimatedPromptTokens >= prefillTokens) {
            console.warn(`[Local AI] Prompt too large: ${estimatedPromptTokens} vs ${prefillTokens}`);
            throw new Error("CONTEXT_OVERFLOW_SLIDER: Prompt exceeds prefill limit.");
        }

        await configureNativeEngine(activeModelId, { prefillTokens, gpuLayers });

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
                stop: ["<end_of_turn>", "<eos>", "user\n", "model\n"]
            },
            "{", // Pre-populated bracket
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

        // FIX: Routes through the robust wrapper to prevent Android Promise race conditions
        const result = await executeNativeCompletion(
            activeLlamaContext,
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: Math.max(0.4, temperature),
                top_k: 40,
                top_p: 0.95,
                stop: ["<end_of_turn>", "<eos>", "user\n", "model\n"] // Aggressively stops hallucinated turns
            },
            "",
            onChunk
        );

        return result;
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
                }
            }
        }
        return fullText;
    } catch (e: any) {
        throw new Error(`GATEWAY_UNREACHABLE.`);
    }
};

export const abortNativeInference = async () => {
    await releaseNativeEngine();
};