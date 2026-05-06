/**
 * @file store/useLocalAIStore.ts
 * @description Local Engine State Management specifically calibrated for Gemma-4 (E2B/E4B).
 * Enforces strict VRAM clamping to prevent Android OS heap exhaustion.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface LocalModel {
    id: string;
    name: string;
    sizeGb: number;
    minRamGb: number;
    isUncensored: boolean;
    tags: string[];
    downloadUrl: string;
    fileName: string;
    architecture: string;
    benchmarks: {
        expectedTokSec: number;
        promptEvalMs: number;
        memoryBandwidth: string;
    };
    description?: string;
}

interface LocalAIState {
    isHardwareCalibrated: boolean;
    isLocalServerEnabled: boolean;
    gatewayUrl: string;
    allowExternalConnections: boolean;

    computeBackend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu';
    threads: number;
    gpuLayers: number;
    temperature: number;
    prefillTokens: number;
    decodeTokens: number;

    cacheTypeK: 'f16' | 'q8_0' | 'q4_0';
    cacheTypeV: 'f16' | 'q8_0' | 'q4_0';
    flashAttn: boolean;
    useMmap: boolean;
    useMlock: boolean;

    activeModelId: string | null;
    downloadedModels: string[];
    downloadProgress: Record<string, number>;

    toggleServer: (enabled: boolean) => void;
    setGatewayUrl: (url: string) => void;
    toggleExternalConnections: (enabled: boolean) => void;
    setComputeBackend: (backend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu') => void;
    setHardwareState: (key: keyof LocalAIState, value: any) => Promise<void>;
    setActiveModel: (id: string | null) => void;

    setDownloadProgress: (id: string, progress: number) => void;
    markDownloaded: (id: string) => void;
    removeModel: (id: string) => void;
    clearDownloadProgress: (id: string) => void;

    calibrateHardwareEngine: (deviceRamGb: number) => void;
    autoCalibrateHardware: () => Promise<void>;
    resetHardwareToDefaults: () => void;
}

export const useLocalAIStore = create<LocalAIState>()(
    persist(
        (set, get) => ({
            isHardwareCalibrated: false,
            isLocalServerEnabled: false,
            gatewayUrl: 'http://127.0.0.1:11434',
            allowExternalConnections: false,

            computeBackend: 'auto',
            threads: 8,
            gpuLayers: -1,
            temperature: 0.15,
            prefillTokens: 3584,
            decodeTokens: 2048,

            cacheTypeK: 'q4_0',
            cacheTypeV: 'q4_0',
            flashAttn: true,
            useMmap: true,
            useMlock: false,

            activeModelId: null,
            downloadedModels: [],
            downloadProgress: {},

            toggleServer: (enabled) => set({ isLocalServerEnabled: enabled }),
            setGatewayUrl: (url) => set({ gatewayUrl: url }),
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
                            }
                        } catch (error) {
                            // Interface not mounted yet
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
                prefillTokens: 3584,
                decodeTokens: 2048,
                cacheTypeK: 'q4_0',
                cacheTypeV: 'q4_0',
                flashAttn: true,
                isHardwareCalibrated: false
            }),

            calibrateHardwareEngine: (deviceRamGb: number) => {
                if (Platform.OS === 'web') {
                    set({
                        computeBackend: 'auto',
                        prefillTokens: 32768,
                        cacheTypeK: 'f16',
                        cacheTypeV: 'f16',
                        flashAttn: true,
                        isHardwareCalibrated: true
                    });
                    return;
                }

                if (deviceRamGb >= 10) {
                    set({
                        computeBackend: 'vulkan',
                        prefillTokens: 3584,
                        cacheTypeK: 'q4_0',
                        cacheTypeV: 'q4_0',
                        flashAttn: true,
                        gpuLayers: -1,
                        isHardwareCalibrated: true
                    });
                } else if (deviceRamGb >= 6) {
                    set({
                        computeBackend: 'vulkan',
                        prefillTokens: 2048,
                        cacheTypeK: 'q4_0',
                        cacheTypeV: 'q4_0',
                        flashAttn: true,
                        gpuLayers: -1,
                        isHardwareCalibrated: true
                    });
                } else {
                    set({
                        computeBackend: 'cpu',
                        prefillTokens: 1024,
                        cacheTypeK: 'q4_0',
                        cacheTypeV: 'q4_0',
                        flashAttn: false,
                        gpuLayers: 0,
                        isHardwareCalibrated: true
                    });
                }
            },

            autoCalibrateHardware: async () => {
                if (get().isHardwareCalibrated) return;

                if (Platform.OS === 'web') {
                    get().calibrateHardwareEngine(32);
                    return;
                }
                try {
                    const totalMemoryBytes = await Device.totalMemory;
                    const ramInBytes = totalMemoryBytes || 8589934592;
                    const ramInGb = ramInBytes / (1024 * 1024 * 1024);
                    get().calibrateHardwareEngine(ramInGb);
                } catch (error) {
                    get().calibrateHardwareEngine(8);
                }
            }
        }),
        {
            name: 'verax-local-ai-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isHardwareCalibrated: state.isHardwareCalibrated,
                isLocalServerEnabled: state.isLocalServerEnabled,
                activeModelId: state.activeModelId,
                gatewayUrl: state.gatewayUrl,
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