/**
 * @file services/localInference.ts
 * @description Native Llama.rn Bridge tailored for Gemma-4 (E2B/E4B) April 2026 Standards.
 * Handles system prompt injection, role mapping, and strict JSON schema extraction.
 */

import { Platform } from 'react-native';
import { useLocalAIStore } from '../store/useLocalAIStore';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AVAILABLE_MODELS } from '../constants/models';

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

const ABSOLUTE_MAX_HARDWARE_CONTEXT = 131072;
const APK_SAFETY_CLAMP = 65536;
const TOKEN_ESTIMATION_FACTOR = 3.2;
const TOKEN_BUFFER = 100;

let initLlama: InitLlamaFn | null = null;

if (Platform.OS !== 'web') {
    try {
        const llamaModule = require('llama.rn');
        initLlama = llamaModule.initLlama;
    } catch (e) {
        console.warn("[VeraxAI] Native llama.rn module not found.");
    }
}

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

// --- PROMPT TEMPLATES (APRIL 30TH G4 UPDATED) ---
const TEMPLATES = {
    gemma4: {
        json: (prompt: string, systemPrompt = "") => {
            const context = systemPrompt ? `<start_of_turn>system\n${systemPrompt}<end_of_turn>\n` : "";
            return `${context}<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;
        },
        chat: (messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => {
            let prompt = "";
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const role = msg.role === 'assistant' ? 'model' : msg.role;
                prompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
            }
            prompt += "<start_of_turn>model\n";
            return prompt;
        },
        stop: ["<end_of_turn>", "<start_of_turn>user", "<start_of_turn>model", "<|channel>"]
    }
};

function buildPrompt(transcript: string, language: string): string {
    return `You are VeraxAI's elite Senior Intelligence Analyst. Produce a flawless JSON dossier.

TARGET OUTPUT LANGUAGE: ${language.toUpperCase()}

CRITICAL JSON SCHEMA REQUIREMENT:
You must output a raw JSON object with EXACTLY these keys to match the database schema. Do not translate the keys.
{
  "summary": "A 2-3 paragraph string summarizing the transcript.",
  "key_takeaways": [{"point": "string", "detail": "string"}],
  "chapters": [{"timestamp": "string", "title": "string", "description": "string"}],
  "conclusion": "A final concluding paragraph string.",
  "seo_metadata": {"title": "string", "tags": ["string"]}
}

STRICT RULES:
1. ALL string values INSIDE the JSON must be in ${language.toUpperCase()}.
2. OUTPUT ONLY VALID JSON. Zero hallucinations. No markdown blocks.

VERBATIM TRANSCRIPT:
"""
${transcript}
"""`;
}

export function buildAgentPrompt(transcript: string, language: string) {
    const fullPrompt = buildPrompt(transcript, language);
    const splitIndex = fullPrompt.indexOf('VERBATIM TRANSCRIPT:');

    if (splitIndex !== -1) {
        const systemInstruction = fullPrompt.substring(0, splitIndex).trim();
        const userMessage = fullPrompt.substring(splitIndex).trim();
        return { systemInstruction, userMessage };
    }

    return {
        systemInstruction: "You are VeraxAI's elite Intelligence Analyst. Produce flawless JSON.",
        userMessage: fullPrompt
    };
}

const estimateTokens = (text: string, buffer: number = 0): number => {
    return Math.ceil(text.length / TOKEN_ESTIMATION_FACTOR) + buffer;
};

const getModelConfig = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
};

const extractCleanJson = (text: string): string => {
    // This strictly isolates the JSON, naturally bypassing <|think|> blocks or preamble
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

export const abortNativeInference = async () => {
    if (engineState.context && Platform.OS !== 'web') {
        try {
            if (typeof engineState.context.stopCompletion === 'function') {
                await engineState.context.stopCompletion();
            } else {
                await engineState.context.release();
                engineState.context = null;
                engineState.modelId = null;
                engineState.contextSize = 0;
            }
        } catch (e) { }
    }
};

export const releaseNativeEngine = async () => {
    if (engineState.context && Platform.OS !== 'web') {
        try {
            await engineState.context.release();
        } catch (e) { } finally {
            engineState.context = null;
            engineState.modelId = null;
            engineState.contextSize = 0;
        }
    }
};

export const configureNativeEngine = async (modelId: string) => {
    const state = useLocalAIStore.getState();
    const { prefillTokens, gpuLayers, cacheTypeK, cacheTypeV, flashAttn } = state;

    let targetContext = Platform.OS === 'web'
        ? ABSOLUTE_MAX_HARDWARE_CONTEXT
        : Math.min(prefillTokens, APK_SAFETY_CLAMP);

    const optimalContext = Math.floor(targetContext / 256) * 256;

    const isMatch = engineState.context && engineState.modelId === modelId && engineState.contextSize === optimalContext;
    if (isMatch) return;

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
            throw new Error(`MODEL_FILE_NOT_FOUND: ${fileName} is missing.`);
        }
    } catch (e: any) {
        throw e;
    }

    try {
        engineState.context = await initLlama({
            contextSize: optimalContext,
            model: modelPath,
            n_gpu_layers: gpuLayers,
            flash_attn: flashAttn,
            cache_type_k: cacheTypeK,
            cache_type_v: cacheTypeV
        });

        engineState.modelId = modelId;
        engineState.contextSize = optimalContext;
    } catch (e: any) {
        const errStr = String(e.message).toLowerCase();
        if (errStr.includes('memory') || errStr.includes('alloc') || errStr.includes('vram')) {
            throw new Error("[Hardware VRAM Exhausted: Decrease Prefill Context Slider]");
        }
        throw new Error(`ENGINE_BOOT_FAILED: ${e.message}`);
    }
};

export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, prefillTokens, decodeTokens, gatewayUrl, temperature } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model selected.");

    if (Platform.OS === 'web') {
        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English");
        const combinedPrompt = `${systemInstruction}\n\n${userMessage}`;
        const mappedMessages = [{ role: 'user', content: combinedPrompt }];
        return runWebProxyInference(mappedMessages, activeModelId, gatewayUrl || "http://127.0.0.1:11434", decodeTokens || 2048, temperature || 0.15, 60000);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    await activateKeepAwakeAsync();

    try {
        const template = TEMPLATES.gemma4;
        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English");

        const formattedPrompt = template.json(userMessage, systemInstruction);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        if (estimatedPromptTokens >= prefillTokens) {
            throw new Error(`[Context Overflow: Transcript is too large (${estimatedPromptTokens} tokens). Local Engine max is ${prefillTokens}. Falling back to Cloud.]`);
        }

        await configureNativeEngine(activeModelId);

        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 20) {
            throw new Error(`[Context Overflow: Transcript is too large. Falling back to Cloud.]`);
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

        return extractCleanJson(result);
    } catch (e: any) {
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
    const { activeModelId, temperature, prefillTokens, decodeTokens, gatewayUrl } = state;

    if (!activeModelId) throw new Error("FAULT: No model selected.");

    if (Platform.OS === 'web') {
        const mappedMessages = messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        }));
        return runWebProxyInference(mappedMessages, activeModelId, gatewayUrl || "http://127.0.0.1:11434", decodeTokens || 2048, temperature || 0.65, 60000);
    }

    await activateKeepAwakeAsync();
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const template = TEMPLATES.gemma4;

        const mappedForTemplate = messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        })) as { role: 'system' | 'user' | 'assistant'; content: string }[];

        const formattedPrompt = template.chat(mappedForTemplate);

        await configureNativeEngine(activeModelId);

        const estimatedPromptTokens = estimateTokens(formattedPrompt);
        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);

        if (safeDecodeLimit < 20) {
            throw new Error(`[Context Overflow: Message exceeds allowed memory limits. Increase slider.]`);
        }

        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

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
        throw e;
    } finally {
        deactivateKeepAwake();
    }
};

async function runWebProxyInference(
    messages: { role: string, content: string }[],
    modelId: string,
    portOrUrl: string,
    maxTokens: number,
    temperature: number,
    timeoutMs: number = 3000
): Promise<string> {
    const isRemoteTunnel = portOrUrl.startsWith('http://') || portOrUrl.startsWith('https://');
    const baseEndpoint = isRemoteTunnel ? portOrUrl : `http://127.0.0.1:${portOrUrl}`;
    const endpoint = `${baseEndpoint.replace(/\/$/, '')}/api/chat`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: modelId,
                messages: messages,
                stream: false,
                options: {
                    temperature: temperature,
                    num_predict: maxTokens,
                }
            }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`WEB_PROXY_ERROR: HTTP ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        const content = json.message?.content || "";
        return messages.length === 1 && messages[0].content.includes('VERBATIM TRANSCRIPT:')
            ? extractCleanJson(content)
            : content;

    } catch (e: any) {
        clearTimeout(timeoutId);
        throw new Error(`GATEWAY_UNREACHABLE: No local engine found. Initiating cloud failover...`);
    }
}