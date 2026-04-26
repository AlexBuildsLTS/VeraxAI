import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';

/**
 * Interface for LiteRT Engine instance
 */
interface LiteRTEngine {
    generateResponse?: (prompt: string, callback: (text: string) => void) => Promise<string>;
    generate?: (prompt: string, callback: (text: string) => void) => Promise<string>;
    chat?: (prompt: string, callback: (text: string) => void) => Promise<string>;
}

/**
 * Interface for LiteRT Core module
 */
interface LiteRTCore {
    createFromOptions?: (options: any) => Promise<LiteRTEngine>;
    create?: (options: any) => Promise<LiteRTEngine>;
    init?: (options: any) => Promise<LiteRTEngine>;
    LlmInference?: LiteRTCore;
    default?: { LlmInference: LiteRTCore };
}

// Dynamically require LiteRT to bypass module resolution issues in Metro/TypeScript
let LlmInference: LiteRTCore | null = null;
if (Platform.OS !== 'web') {
    try {
        // @ts-ignore
        const litert = require('@litertjs/core');
        LlmInference = litert.LlmInference || litert.default?.LlmInference || litert;
    } catch (e) {
        console.warn("[LiteRT] Core module bindings not found. Native inference will be unavailable.");
    }
}

// Singleton engine instance and tracking
let litertEngine: LiteRTEngine | null = null;
let lastInitializedModelId: string | null = null;

/**
 * Formats the prompt for the Gemma model family
 */
const formatGemmaPrompt = (prompt: string): string => {
    return `<bos><start_of_turn>user\nYou are a Data Extraction Specialist. Output ONLY valid JSON matching the requested schema. Zero hallucinations.\n\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;
};

/**
 * Native implementation of LiteRT inference
 */
const runNativeInference = async (
    prompt: string,
    modelId: string,
    options: { temperature: number; decodeTokens: number },
    onChunk?: (token: string) => void
): Promise<string> => {
    try {
        // @ts-ignore
        const FileSystem = require('expo-file-system/legacy');
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';
        let modelPath = `${docDir}${modelId}.litertlm`.replace('file://', '');

        // Re-initialize if model changed or engine is missing
        if (!litertEngine || lastInitializedModelId !== modelId) {
            if (!LlmInference) {
                throw new Error("LITERT_MISSING_BINDINGS: Native JSI bindings not found.");
            }

            const createFunc = LlmInference.createFromOptions || LlmInference.create || LlmInference.init;
            if (!createFunc) {
                throw new Error("LITERT_INIT_FAULT: Initialization function not found in core module.");
            }

            console.log(`[LiteRT] Initializing engine for model: ${modelId}`);
            litertEngine = await createFunc({
                modelPath,
                maxTokens: options.decodeTokens,
                temperature: options.temperature,
                topK: 40
            });
            lastInitializedModelId = modelId;
        }

        const formattedPrompt = formatGemmaPrompt(prompt);
        const generateFunc = litertEngine!.generateResponse || litertEngine!.generate || litertEngine!.chat;
        
        if (!generateFunc) {
            throw new Error("LITERT_EXECUTION_FAULT: Generation method not found on engine instance.");
        }

        return await generateFunc.call(litertEngine, formattedPrompt, (partialText: string) => {
            onChunk?.(partialText);
        });
    } catch (e: any) {
        console.error("[LiteRT Native Error]", e);
        throw new Error(`LITERT_NATIVE_FAILURE: ${e.message}`);
    }
};

/**
 * Web implementation using local HTTP gateway (e.g. LM Studio, Ollama)
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
                max_tokens: options.decodeTokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`GATEWAY_ERROR: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (!reader) return "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            fullText += content;
                            onChunk?.(content);
                        }
                    } catch (e) {
                        // Ignore partial JSON chunks, they will be handled in the next iteration if needed
                        // or if the stream is properly formatted, this shouldn't happen often.
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
    const { activeModelId, temperature, port, decodeTokens } = useLocalAIStore.getState();

    if (!activeModelId) {
        throw new Error("INFERENCE_FAULT: No active model selected in settings.");
    }

    if (Platform.OS !== 'web') {
        return runNativeInference(prompt, activeModelId, { temperature, decodeTokens }, onChunk);
    }

    return runWebInference(prompt, activeModelId, { port, temperature, decodeTokens }, onChunk);
};
