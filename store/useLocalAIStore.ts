/**
 * @file store/useLocalAIStore.ts
 * @description Local Engine State Management calibrated for Gemma-4 (E2B/E4B).
 * Enforces strict VRAM clamping and optimal GPU layer offloading.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

interface LocalAIState {
    activeModelId: string | null;
    downloadedModels: string[];
    isHardwareCalibrated: boolean;

    // Hardware Settings
    prefillTokens: number;
    decodeTokens: number;
    gpuLayers: number;
    threads: number;
    nBatch: number;
    useMmap: boolean;
    useMlock: boolean;
    flashAttn: boolean;
    cacheTypeK: 'f16' | 'q4_0' | 'q8_0';
    cacheTypeV: 'f16' | 'q4_0' | 'q8_0';
    temperature: number;
    gatewayUrl: string;

    // Actions
    calibrateHardware: () => Promise<void>;
    setActiveModel: (id: string | null) => void;
    addDownloadedModel: (id: string) => void;
    removeModel: (id: string) => void;
    updateSettings: (settings: Partial<LocalAIState>) => void;
}

export const useLocalAIStore = create<LocalAIState>()(
    persist(
        (set, get) => ({
            activeModelId: null,
            downloadedModels: [],
            isHardwareCalibrated: false,

            // Default values optimized for mobile edge
            prefillTokens: 3584,
            decodeTokens: 2048,
            gpuLayers: 28, // Correct target for Gemma 2B/4B on Pixel/Snapdragon GPUs
            threads: 4,
            nBatch: 128, // Throttles allocation spikes to prevent Android OOM
            useMmap: true,
            useMlock: false,
            flashAttn: false, // Disabled by default for Vulkan stability on Tensor G2
            cacheTypeK: 'q4_0',
            cacheTypeV: 'q4_0',
            temperature: 0.15,
            gatewayUrl: 'http://127.0.0.1:11434',

            calibrateHardware: async () => {
                if (get().isHardwareCalibrated) return;

                const totalRam = await DeviceInfo.getTotalMemory();
                const ramGB = totalRam / (1024 * 1024 * 1024);

                let safePrefill = 3584;
                let safeThreads = 4;
                let safeLayers = 28;

                if (Platform.OS === 'web') {
                    set({
                        prefillTokens: 32768,
                        threads: 8,
                        gpuLayers: -1,
                        nBatch: 1024,
                        isHardwareCalibrated: true
                    });
                    return;
                }

                if (ramGB >= 10) {
                    safePrefill = 8192;
                    safeThreads = 6;
                    safeLayers = 32;
                } else if (ramGB >= 6) {
                    safePrefill = 3584;
                    safeThreads = 4;
                    safeLayers = 28; // Target for 8GB devices like Pixel 7
                } else {
                    safePrefill = 1024;
                    safeThreads = 2;
                    safeLayers = 0;
                }

                set({
                    prefillTokens: safePrefill,
                    threads: safeThreads,
                    gpuLayers: safeLayers,
                    nBatch: 128,
                    isHardwareCalibrated: true,
                    useMmap: true,
                    cacheTypeK: 'q4_0',
                    cacheTypeV: 'q4_0'
                });
            },

            setActiveModel: (id) => set({ activeModelId: id }),

            addDownloadedModel: (id) => {
                const current = get().downloadedModels;
                if (!current.includes(id)) {
                    set({ downloadedModels: [...current, id] });
                }
            },

            removeModel: (id) => {
                set((state) => ({
                    downloadedModels: state.downloadedModels.filter((m) => m !== id),
                    activeModelId: state.activeModelId === id ? null : state.activeModelId,
                }));
            },

            updateSettings: (settings) => {
                const criticalKeys = ['prefillTokens', 'gpuLayers', 'cacheTypeK', 'cacheTypeV', 'flashAttn', 'nBatch'];
                const shouldRelease = Object.keys(settings).some(k => criticalKeys.includes(k));

                set((state) => ({ ...state, ...settings }));

                if (shouldRelease && Platform.OS !== 'web') {
                    try {
                        const { releaseNativeEngine } = require('../services/localInference');
                        releaseNativeEngine();
                    } catch (e) { }
                }
            },
        }),
        {
            name: 'verax-local-ai-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                activeModelId: state.activeModelId,
                downloadedModels: state.downloadedModels,
                isHardwareCalibrated: state.isHardwareCalibrated,
                prefillTokens: state.prefillTokens,
                decodeTokens: state.decodeTokens,
                gpuLayers: state.gpuLayers,
                threads: state.threads,
                nBatch: state.nBatch,
                useMmap: state.useMmap,
                cacheTypeK: state.cacheTypeK,
                cacheTypeV: state.cacheTypeV,
                flashAttn: state.flashAttn,
                temperature: state.temperature,
                gatewayUrl: state.gatewayUrl,
            }),
        }
    )
);