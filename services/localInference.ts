import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * ----------------------------------------------------------------------------
 * NATIVE ENGINE: llama.rn (llama.cpp for React Native)
 * ----------------------------------------------------------------------------
 */
let LlamaContext: any = null;
if (Platform.OS !== 'web') {
    try {
        const { initLlama } = require('llama.rn');
        LlamaContext = initLlama;
    } catch (e) {
        console.warn("[Local AI] llama.rn module not found. Ensure the native module is linked.");
    }
}

let activeLlamaContext: any = null;
let lastContextModelId: string | null = null;

// Gemma 4 specific prompt wrapping to enforce JSON constraints
const formatGemmaPrompt = (prompt: string): string => {
    return `<bos><start_of_turn>user\nYou are an elite Data Extraction Specialist. Extract strict JSON based on the provided instructions.\n\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;
};

const runNativeInference = async (
    prompt: string,
    modelId: string,
    options: { temperature: number; decodeTokens: number; gpuLayers: number },
    onChunk?: (token: string) => void
): Promise<string> => {
    await activateKeepAwakeAsync();

    try {
        const FileSystem = require('expo-file-system/legacy');
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';

        let fileName = 'google_gemma-4-E2B-it-bf16.gguf';
        if (modelId === 'gemma-4-e4b-it-unsloth') fileName = 'gemma-4-E4B-it-Q4_K_M.gguf';
        if (modelId === 'gemma-4-e2b-it-unsloth') fileName = 'gemma-4-E2B-it-UD-Q4_K_XL.gguf';

        let modelPath = `${docDir}${fileName}`.replace('file://', '');

        if (!LlamaContext) {
            throw new Error("LLAMA_NATIVE_MISSING: The llama.rn native module is not initialized.");
        }

        // Initialize or Reuse Hardware Context
        if (!activeLlamaContext || lastContextModelId !== modelId) {
            if (activeLlamaContext) {
                console.log(`[Local AI] Releasing previous hardware context for ${lastContextModelId}`);
                await activeLlamaContext.release();
            }

            console.log(`[Local AI] Booting llama.rn engine for model: ${modelId}`);

            // CRITICAL FIX: Removed use_mlock: true which was crashing Android Native.
            activeLlamaContext = await LlamaContext({
                contextSize: 4096, // Safe threshold for mobile RAM
                model: modelPath,
                n_gpu_layers: options.gpuLayers,
            });
            lastContextModelId = modelId;
        }

        const formattedPrompt = formatGemmaPrompt(prompt);
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
 * Dynamically routes to Web HTTP fetch or Native Llama.cpp binding
 */
export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const { activeModelId, temperature, port, decodeTokens, gpuLayers } = useLocalAIStore.getState();

    if (!activeModelId) {
        throw new Error("INFERENCE_FAULT: No active model selected in settings.");
    }

    if (Platform.OS !== 'web') {
        return runNativeInference(prompt, activeModelId, { temperature, decodeTokens, gpuLayers }, onChunk);
    }

    return runWebInference(prompt, activeModelId, { port, temperature, decodeTokens }, onChunk);
};

/**
 * PRODUCTION SAFEGUARD 3: Memory Leak Prevention
 * Exposes a method to force-release the llama.rn context if the user aborts
 * the generation or unmounts the screen, preventing zombie RAM lockups.
 */
export const abortNativeInference = async () => {
    if (activeLlamaContext && Platform.OS !== 'web') {
        console.log(`[Local AI] Force-aborting context. Freeing RAM...`);
        try {
            await activeLlamaContext.release();
            activeLlamaContext = null;
            lastContextModelId = null;
        } catch (e) {
            console.error("[Local AI] Failed to release context during abort.", e);
        }
    }
}