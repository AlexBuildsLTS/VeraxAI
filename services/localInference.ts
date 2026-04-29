/**
 * services/localInference.ts
 * Native Llama.rn Bridge & Hardware Watchdog
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - HARDWARE AGNOSTIC: Allocates RAM exactly based on user store preferences.
 * - STRICT CONTEXT MATH: n_ctx = prefillTokens + decodeTokens.
 * - PREDICTIVE SHIELD: Throws CONTEXT_OVERFLOW if prompt exceeds prefill limit,
 *   preventing silent OS-level C++ crashes.
 * ----------------------------------------------------------------------------
 */

import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

let LlamaContext: any = null;
if (Platform.OS !== 'web') {
    try {
        const { initLlama } = require('llama.rn');
        LlamaContext = initLlama;
    } catch (e) {
        console.warn("[Local AI] llama.rn module not found. Ensure the native module is linked.");
    }
}

// ─── SINGLETON ENGINE TRACKING ───────────────────────────────────────────────
let activeLlamaContext: any = null;
let activeModelId: string | null = null;
let activeContextSize: number = 0;
let activeGpuLayers: number = 0;

const formatGemmaPrompt = (prompt: string): string => {
    return `<bos><start_of_turn>user\nYou are an elite Data Extraction Specialist. Extract strict JSON based on the provided instructions. DO NOT use markdown code blocks.\n\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;
};

/**
 * PRODUCTION SAFEGUARD: Memory Leak Prevention & Reconfiguration
 */
export const releaseNativeEngine = async () => {
    if (activeLlamaContext && Platform.OS !== 'web') {
        console.log(`[Local AI] Force-aborting context. Freeing RAM...`);
        try {
            await activeLlamaContext.release();
            activeLlamaContext = null;
            activeModelId = null;
            activeContextSize = 0;
        } catch (e) {
            console.error("[Local AI] Failed to release context during abort.", e);
        }
    }
};

/**
 * Instantiates the hardware context directly tied to UI sliders.
 */
export const configureNativeEngine = async (
    modelId: string,
    options: { prefillTokens: number; decodeTokens: number; gpuLayers: number }
) => {
    // 1. Calculate Total Required RAM block (n_ctx must fit both prompt and generated output)
    const requiredContextSize = options.prefillTokens + options.decodeTokens;

    const isModelMatch = activeModelId === modelId;
    const isContextMatch = activeContextSize === requiredContextSize;
    const isGpuMatch = activeGpuLayers === options.gpuLayers;

    // If engine is missing OR the user changed sliders, reboot the engine into new RAM footprint.
    if (!activeLlamaContext || !isModelMatch || !isContextMatch || !isGpuMatch) {
        await releaseNativeEngine();

        console.log(`[Local AI] Booting llama.rn engine for model: ${modelId} | Allocated Context: ${requiredContextSize} tokens`);

        const FileSystem = require('expo-file-system/legacy');
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';

        let fileName = 'google_gemma-4-E2B-it-bf16.gguf';
        if (modelId === 'gemma-4-e4b-it-unsloth') fileName = 'gemma-4-E4B-it-Q4_K_M.gguf';
        if (modelId === 'gemma-4-e2b-it-unsloth') fileName = 'gemma-4-E2B-it-UD-Q4_K_XL.gguf';

        const modelPath = `${docDir}${fileName}`.replace('file://', '');

        if (!LlamaContext) {
            throw new Error("LLAMA_NATIVE_MISSING: The llama.rn native module is not initialized.");
        }

        activeLlamaContext = await LlamaContext({
            contextSize: requiredContextSize,
            model: modelPath,
            n_gpu_layers: options.gpuLayers,
        });

        activeModelId = modelId;
        activeContextSize = requiredContextSize;
        activeGpuLayers = options.gpuLayers;
    }
};

/**
 * ----------------------------------------------------------------------------
 * NATIVE ENGINE: llama.rn (llama.cpp for React Native)
 * ----------------------------------------------------------------------------
 */
const runNativeInference = async (
    prompt: string,
    modelId: string,
    options: { temperature: number; prefillTokens: number; decodeTokens: number; gpuLayers: number },
    onChunk?: (token: string) => void
): Promise<string> => {
    await activateKeepAwakeAsync();

    try {
        const formattedPrompt = formatGemmaPrompt(prompt);

        // Predictive Hardware Shield: Stop it before C++ crashes if the prompt exceeds the Prefill Slider
        // Math: 1 token is roughly 3.5 characters.
        const estimatedTokens = Math.ceil(formattedPrompt.length / 3.5);
        if (estimatedTokens > options.prefillTokens) {
            throw new Error("CONTEXT_OVERFLOW");
        }

        // Ensure hardware is configured to match the user's sliders
        await configureNativeEngine(modelId, options);

        let fullText = "";
        const safeDecodeLimit = Math.max(options.decodeTokens, 1024);

        return new Promise((resolve, reject) => {
            activeLlamaContext.completion(
                {
                    prompt: formattedPrompt,
                    n_predict: safeDecodeLimit,
                    temperature: options.temperature,
                    top_k: 40,
                    top_p: 0.95
                },
                (data: { token: string }) => {
                    fullText += data.token;
                    if (onChunk) onChunk(data.token);
                }
            ).then(() => {
                resolve(fullText);
            }).catch((err: any) => {
                reject(err);
            });
        });

    } catch (e: any) {
        console.error("[Local AI Native Error]", e);
        if (e.message === 'CONTEXT_OVERFLOW') throw e;
        throw new Error(`NATIVE_INFERENCE_FAILURE: ${e.message}`);
    } finally {
        deactivateKeepAwake();
    }
};

/**
 * ----------------------------------------------------------------------------
 * WEB ENGINE: Local HTTP Gateway (LM Studio / Ollama)
 * ----------------------------------------------------------------------------
 */
const runWebInference = async (
    prompt: string,
    modelId: string,
    options: { port: string; temperature: number; decodeTokens: number },
    onChunk?: (token: string) => void
): Promise<string> => {
    const endpoint = `http://127.0.0.1:${options.port}/v1/chat/completions`;

    try {
        const safeDecodeLimit = Math.max(options.decodeTokens, 1024);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: prompt }],
                temperature: options.temperature,
                max_tokens: safeDecodeLimit,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`GATEWAY_ERROR: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        if (!reader) return "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            fullText += content;
                            onChunk?.(content);
                        }
                    } catch (e) {
                        // Silently catch buffer fragmentation
                    }
                }
            }
        }
        return fullText;
    } catch (e: any) {
        throw new Error(`GATEWAY_UNREACHABLE: Failed to connect to local runner on port ${options.port}.`);
    }
};

/**
 * Main entry point for local AI inference
 */
export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const { activeModelId, temperature, port, prefillTokens, decodeTokens, gpuLayers } = useLocalAIStore.getState();

    if (!activeModelId) {
        throw new Error("INFERENCE_FAULT: No active model selected in settings.");
    }

    if (Platform.OS !== 'web') {
        return runNativeInference(prompt, activeModelId, { temperature, prefillTokens, decodeTokens, gpuLayers }, onChunk);
    }

    return runWebInference(prompt, activeModelId, { port, temperature, decodeTokens }, onChunk);
};

export const abortNativeInference = async () => {
    await releaseNativeEngine();
};