/**
 * store/useLocalAIStore.ts
 * Enterprise State Manager for On-Device LLM Processing
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalModel {
    id: string;
    name: string;
    sizeGb: number;
    minRamGb: number;
    isUncensored: boolean;
    tags: string[];
    downloadUrl: string;
    fileName: string;
    architecture: 'gemma4' | 'phi3';
    benchmarks: {
        expectedTokSec: number;
        promptEvalMs: number;
        memoryBandwidth: string;
    };
    description?: string;
}

interface LocalAIState {
    // Networking
    isLocalServerEnabled: boolean;
    port: string;
    allowExternalConnections: boolean;

    // Hardware Tuning
    computeBackend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu';
    threads: number;
    gpuLayers: number;
    temperature: number;
    prefillTokens: number;
    decodeTokens: number;

    // Model State
    activeModelId: string | null;
    downloadedModels: string[]; // List of IDs marking readiness
    downloadProgress: Record<string, number>;

    // Core Actions
    toggleServer: (enabled: boolean) => void;
    setPort: (port: string) => void;
    toggleExternalConnections: (enabled: boolean) => void;
    setComputeBackend: (backend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu') => void;
    setHardwareState: (key: 'threads' | 'gpuLayers' | 'temperature' | 'prefillTokens' | 'decodeTokens', value: number) => void;
    setActiveModel: (id: string | null) => void;

    // File System Actions
    setDownloadProgress: (id: string, progress: number) => void;
    markDownloaded: (id: string, uri?: string) => void;
    removeModel: (id: string) => void;
    clearDownloadProgress: (id: string) => void;
}

export const useLocalAIStore = create<LocalAIState>()(
    persist(
        (set) => ({
            isLocalServerEnabled: false,
            port: '4891',
            allowExternalConnections: false,

            computeBackend: 'auto',
            threads: 4,
            gpuLayers: 33,
            temperature: 0.3,
            prefillTokens: 256,
            decodeTokens: 256,

            activeModelId: null,
            downloadedModels: [],
            downloadProgress: {},

            toggleServer: (enabled) => set({ isLocalServerEnabled: enabled }),
            setPort: (port) => set({ port }),
            toggleExternalConnections: (enabled) => set({ allowExternalConnections: enabled }),
            setComputeBackend: (backend) => set({ computeBackend: backend }),

            setHardwareState: (key, value) => set((state) => ({ ...state, [key]: value })),

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
                downloadedModels: Array.isArray(state.downloadedModels) ? state.downloadedModels : [],
            }),
        }
    )
);