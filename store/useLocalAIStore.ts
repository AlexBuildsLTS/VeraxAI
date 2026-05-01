/**
 * @file store/useLocalAIStore.ts
 * @description Enhanced Local Engine State Management for Gemma 4 (Post-April 22nd Update)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface LocalModel {
    id: string;
    name: string;
    sizeGb: number;
    minRamGb: number;
    isUncensored: boolean;
    tags: string[];
    downloadUrl: string;
    fileName: string;
    architecture: 'gemma4';
    benchmarks: {
        expectedTokSec: number;
        promptEvalMs: number;
        memoryBandwidth: string;
    };
    description?: string;
}

interface LocalAIState {
    // Networking & Server
    isLocalServerEnabled: boolean;
    port: string;
    allowExternalConnections: boolean;

    // Hardware & Inference Tuning
    computeBackend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu';
    threads: number;
    gpuLayers: number;
    temperature: number;
    prefillTokens: number;
    decodeTokens: number;

    // KV Cache & Performance Protocols (April 22nd Engine Update)
    cacheTypeK: 'f16' | 'q8_0' | 'q4_0';
    cacheTypeV: 'f16' | 'q8_0' | 'q4_0';
    flashAttn: boolean;
    useMmap: boolean;
    useMlock: boolean;

    // Model Lifecycle State
    activeModelId: string | null;
    downloadedModels: string[];
    downloadProgress: Record<string, number>;

    // Management Actions
    toggleServer: (enabled: boolean) => void;
    setPort: (port: string) => void;
    toggleExternalConnections: (enabled: boolean) => void;
    setComputeBackend: (backend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu') => void;
    setHardwareState: (key: keyof LocalAIState, value: any) => Promise<void>;
    setActiveModel: (id: string | null) => void;

    // Storage Actions
    setDownloadProgress: (id: string, progress: number) => void;
    markDownloaded: (id: string) => void;
    removeModel: (id: string) => void;
    clearDownloadProgress: (id: string) => void;
    resetHardwareToDefaults: () => void;
}

export const useLocalAIStore = create<LocalAIState>()(
    persist(
        (set, get) => ({
            // Networking Defaults
            isLocalServerEnabled: false,
            port: '4891',
            allowExternalConnections: false,

            // Hardware Defaults for Gemma 4 Q4 Unsloth
            computeBackend: 'auto',
            threads: 8,
            gpuLayers: -1,
            temperature: 0.15,
            prefillTokens: 16384,
            decodeTokens: 2048,

            // April 22nd Performance Protocols
            cacheTypeK: 'q8_0',
            cacheTypeV: 'q8_0',
            flashAttn: true,
            useMmap: true,
            useMlock: false,

            activeModelId: null,
            downloadedModels: [],
            downloadProgress: {},

            toggleServer: (enabled) => set({ isLocalServerEnabled: enabled }),

            setPort: (port) => set({ port }),

            toggleExternalConnections: (enabled) => set({ allowExternalConnections: enabled }),

            setComputeBackend: (backend) => set({ computeBackend: backend }),

            setHardwareState: async (key, value) => {
                set((state) => ({ ...state, [key]: value }));

                const criticalKeys = ['prefillTokens', 'decodeTokens', 'gpuLayers', 'cacheTypeK', 'cacheTypeV', 'flashAttn'];

                if (criticalKeys.includes(key as string)) {
                    if (Platform.OS !== 'web') {
                        try {
                            const { releaseNativeEngine } = require('../services/localInference');
                            if (releaseNativeEngine) {
                                await releaseNativeEngine();
                                console.log(`[Local AI Store] Flush triggered by ${key} change.`);
                            }
                        } catch (error) {
                            // Interface not yet mounted
                        }
                    }
                }
            },

            setActiveModel: (id) => set({ activeModelId: id }),

            setDownloadProgress: (id, progress) => set((state) => ({
                downloadProgress: { ...state.downloadProgress, [id]: progress }
            })),

            markDownloaded: (id) => set((state) => {
                const newProgress = { ...state.downloadProgress };
                delete newProgress[id];
                return {
                    downloadedModels: Array.from(new Set([...state.downloadedModels, id])),
                    downloadProgress: newProgress
                };
            }),

            removeModel: (id) => set((state) => ({
                downloadedModels: state.downloadedModels.filter(mId => mId !== id),
                activeModelId: state.activeModelId === id ? null : state.activeModelId
            })),

            clearDownloadProgress: (id) => set((state) => {
                const newProgress = { ...state.downloadProgress };
                delete newProgress[id];
                return { downloadProgress: newProgress };
            }),

            resetHardwareToDefaults: () => set({
                gpuLayers: -1,
                threads: 8,
                temperature: 0.15,
                prefillTokens: 16384,
                decodeTokens: 2048,
                cacheTypeK: 'q8_0',
                cacheTypeV: 'q8_0',
                flashAttn: true
            })
        }),
        {
            name: 'verax-local-ai-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isLocalServerEnabled: state.isLocalServerEnabled,
                activeModelId: state.activeModelId,
                port: state.port,
                allowExternalConnections: state.allowExternalConnections,
                computeBackend: state.computeBackend,
                threads: state.threads,
                gpuLayers: state.gpuLayers,
                temperature: state.temperature,
                prefillTokens: state.prefillTokens,
                decodeTokens: state.decodeTokens,
                cacheTypeK: state.cacheTypeK,
                cacheTypeV: state.cacheTypeV,
                flashAttn: state.flashAttn,
                useMmap: state.useMmap,
                useMlock: state.useMlock,
                downloadedModels: state.downloadedModels,
            }),
        }
    )
);