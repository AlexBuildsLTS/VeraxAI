/**
 * @file services/localInference.ts
 * @description Native Llama.rn Bridge tailored for Gemma-4.
 * CRITICAL FIX: Deterministic Web Proxy routing using VERBATIM TRANSCRIPT signature.
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
    n_ctx: number;
    model: string;
    n_gpu_layers: number;
    flash_attn?: boolean;
    cache_type_k?: string;
    cache_type_v?: string;
    use_mmap?: boolean;
    use_mlock?: boolean;
    n_threads?: number;
    n_batch?: number;
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

// ─── PROMPT TEMPLATES ────────────────────────────────────────────────────────
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

const extractCleanJson = (text: string): string => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end >= start) {
        return text.substring(start, end + 1);
    }
    return text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim() || "{}";
};

// ─── ENGINE MANAGEMENT ───────────────────────────────────────────────────────

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
    const { prefillTokens, gpuLayers, cacheTypeK, cacheTypeV, flashAttn, useMmap, useMlock, threads, nBatch } = state;

    let targetContext = Platform.OS === 'web'
        ? ABSOLUTE_MAX_HARDWARE_CONTEXT
        : Math.min(prefillTokens, APK_SAFETY_CLAMP);

    const optimalContext = Math.floor(targetContext / 256) * 256;

    if (engineState.context && engineState.modelId === modelId && engineState.contextSize === optimalContext) return;

    await releaseNativeEngine();

    if (!initLlama) throw new Error("LLAMA_NATIVE_MISSING: Native module not initialized.");

    const FileSystem = require('expo-file-system/legacy');
    const docDir = FileSystem.documentDirectory || 'file:///tmp/';
    const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
    const modelPath = `${docDir}${model.fileName}`.replace('file://', '');

    try {
        const fileInfo = await FileSystem.getInfoAsync(`file://${modelPath}`);
        if (!fileInfo.exists) throw new Error(`MODEL_FILE_NOT_FOUND: ${model.fileName}`);
    } catch (e: any) {
        throw new Error("MODEL_FILE_ACCESS_DENIED");
    }

    try {
        engineState.context = await initLlama({
            n_ctx: optimalContext,
            model: modelPath,
            n_gpu_layers: gpuLayers,
            flash_attn: flashAttn,
            cache_type_k: cacheTypeK,
            cache_type_v: cacheTypeV,
            use_mmap: useMmap,
            use_mlock: useMlock,
            n_threads: threads,
            n_batch: nBatch
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

// ─── TRANSCRIBER & CHAT INFERENCE ────────────────────────────────────────────

export const runLocalInference = async (prompt: string, onChunk?: (token: string) => void): Promise<string> => {
    const state = useLocalAIStore.getState();
    const { activeModelId, prefillTokens, decodeTokens, gatewayUrl, temperature } = state;

    if (!activeModelId) throw new Error("INFERENCE_FAULT: No active model selected.");

    if (Platform.OS === 'web') {
        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English");
        const mappedMessages = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userMessage }
        ];
        return runWebProxyInference(mappedMessages, activeModelId, gatewayUrl || "http://127.0.0.1:11434", decodeTokens || 2048, temperature || 0.15, 60000);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    await activateKeepAwakeAsync();

    try {
        const { systemInstruction, userMessage } = buildAgentPrompt(prompt, "English");
        const formattedPrompt = TEMPLATES.gemma4.json(userMessage, systemInstruction);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        if (estimatedPromptTokens >= prefillTokens) {
            throw new Error(`[Context Overflow: Transcript is too large (${estimatedPromptTokens} tokens). Local Engine max is ${prefillTokens}. Falling back to Cloud.]`);
        }

        await configureNativeEngine(activeModelId);

        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 20) throw new Error(`[Context Overflow: Transcript is too large.]`);
        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

        let fullText = "";
        await engineState.context.completion(
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: 0.15,
                top_k: 40,
                top_p: 0.95,
                stop: TEMPLATES.gemma4.stop
            },
            (data) => {
                fullText += data.token;
                if (onChunk) onChunk(data.token);
            }
        );

        return extractCleanJson(fullText);
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
        const mappedForTemplate = messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        })) as { role: 'system' | 'user' | 'assistant'; content: string }[];

        const formattedPrompt = TEMPLATES.gemma4.chat(mappedForTemplate);
        const estimatedPromptTokens = estimateTokens(formattedPrompt, TOKEN_BUFFER);

        await configureNativeEngine(activeModelId);

        const safeDecodeLimit = Math.min(decodeTokens, prefillTokens - estimatedPromptTokens);
        if (safeDecodeLimit < 20) throw new Error(`[Context Overflow: Memory limit exceeded.]`);
        if (!engineState.context) throw new Error("ENGINE_NOT_READY");

        let fullText = "";
        await engineState.context.completion(
            {
                prompt: formattedPrompt,
                n_predict: safeDecodeLimit,
                temperature: Math.max(0.65, temperature),
                top_k: 40,
                top_p: 0.9,
                stop: TEMPLATES.gemma4.stop
            },
            (data) => {
                fullText += data.token;
                if (onChunk) onChunk(data.token);
            }
        );
        return fullText;
    } catch (e: any) {
        throw e;
    } finally {
        deactivateKeepAwake();
    }
};

// ─── STRICT OPENAI-COMPATIBLE WEB PROXY ──────────────────────────────────────

async function runWebProxyInference(
    messages: { role: string, content: string }[],
    modelId: string,
    portOrUrl: string,
    maxTokens: number,
    temperature: number,
    timeoutMs: number = 60000
): Promise<string> {
    const baseEndpoint = portOrUrl.startsWith('http') ? portOrUrl : `http://127.0.0.1:${portOrUrl}`;
    const endpoint = `${baseEndpoint.replace(/\/$/, '')}/v1/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const payload = {
            model: modelId,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`WEB_PROXY_ERROR: HTTP ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || "";

        // CRITICAL FIX: Deterministic routing for Transcriber vs Chat Sandbox
        return messages.length > 1 && messages[0].role === 'system' && messages[1].content.includes('VERBATIM TRANSCRIPT:')
            ? extractCleanJson(content)
            : content;

    } catch (e: any) {
        clearTimeout(timeoutId);
        throw new Error(`GATEWAY_REJECTED: Protocol mismatch or daemon offline. ${e.message}`);
    }
}