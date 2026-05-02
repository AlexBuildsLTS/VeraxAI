/**
 * @file store/useLocalAIStore.ts
 * @description Enhanced Local Engine State Management for Gemma 4 & Web Gateway
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - FULL PARITY: Merges the April 22nd Android Hardware Protocols (KV Cache, 
 *   Flash Attention) with the Web Gateway HTTPS Tunneling logic.
 * - DYNAMIC AUTO-CALIBRATION: Automatically probes physical memory using expo-device
 *   to establish safe boundaries for context windows and GPU layers.
 * - STRICT TYPING: Complete TS Interface mapping to prevent compiler regressions.
 * ----------------------------------------------------------------------------
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
    architecture: 'gemma4' | 'phi3';
    benchmarks: {
        expectedTokSec: number;
        promptEvalMs: number;
        memoryBandwidth: string;
    };
    description?: string;
}

interface LocalAIState {
    // Initialization State
    isHardwareCalibrated: boolean;

    // Networking & Web Gateway
    isLocalServerEnabled: boolean;
    gatewayUrl: string;
    allowExternalConnections: boolean;

    // Hardware & Inference Tuning
    computeBackend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu';
    threads: number;
    gpuLayers: number;
    temperature: number;
    prefillTokens: number;
    decodeTokens: number;

    // KV Cache & Performance Protocols
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
    setGatewayUrl: (url: string) => void;
    toggleExternalConnections: (enabled: boolean) => void;
    setComputeBackend: (backend: 'auto' | 'metal' | 'vulkan' | 'opencl' | 'cpu') => void;
    setHardwareState: (key: keyof LocalAIState, value: any) => Promise<void>;
    setActiveModel: (id: string | null) => void;

    // Storage Actions
    setDownloadProgress: (id: string, progress: number) => void;
    markDownloaded: (id: string) => void;
    removeModel: (id: string) => void;
    clearDownloadProgress: (id: string) => void;

    // Hardware Auto-Calibration
    calibrateHardwareEngine: (deviceRamGb: number) => void;
    autoCalibrateHardware: () => Promise<void>;
    resetHardwareToDefaults: () => void;
}

export const useLocalAIStore = create<LocalAIState>()(
    persist(
        (set, get) => ({
            isHardwareCalibrated: false,

            // Networking Defaults
            isLocalServerEnabled: false,
            gatewayUrl: 'http://127.0.0.1:11434',
            allowExternalConnections: false,

            // Failsafe Hardware Defaults (Overwritten by autoCalibrate)
            computeBackend: 'auto',
            threads: 8,
            gpuLayers: -1,
            temperature: 0.15,
            prefillTokens: 8192,
            decodeTokens: 2048,

            cacheTypeK: 'q8_0',
            cacheTypeV: 'q8_0',
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
                                console.log(`[Local AI Store] Hardware flush triggered by ${key} modification.`);
                            }
                        } catch (error) {
                            // Interface not yet mounted; safe to ignore
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
                prefillTokens: 8192,
                decodeTokens: 2048,
                cacheTypeK: 'q8_0',
                cacheTypeV: 'q8_0',
                flashAttn: true,
                isHardwareCalibrated: false
            }),

            // DIRECT CALIBRATION: Scales parameters purely off RAM threshold logic
            calibrateHardwareEngine: (deviceRamGb: number) => {
                if (Platform.OS === 'web') {
                    // Web gateway delegates to desktop host hardware. Maximum parameters safe.
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

                // Native Android Hardware Matrix
                if (deviceRamGb >= 10) {
                    // Flagship (e.g., Pixel 7/8 Pro, S24 Ultra)
                    set({
                        computeBackend: 'vulkan',
                        prefillTokens: 32768,
                        cacheTypeK: 'q8_0',
                        cacheTypeV: 'q8_0',
                        flashAttn: true,
                        gpuLayers: -1,
                        isHardwareCalibrated: true
                    });
                } else if (deviceRamGb >= 6) {
                    // Mid-Range
                    set({
                        computeBackend: 'vulkan',
                        prefillTokens: 16384,
                        cacheTypeK: 'q8_0',
                        cacheTypeV: 'q8_0',
                        flashAttn: true,
                        gpuLayers: -1,
                        isHardwareCalibrated: true
                    });
                } else {
                    // Budget/Constrained
                    set({
                        computeBackend: 'cpu', // Fallback to CPU to prevent Vulkan pipeline crashes
                        prefillTokens: 8192,
                        cacheTypeK: 'q4_0', // Heavy compression to prevent VRAM allocation fail
                        cacheTypeV: 'q4_0',
                        flashAttn: false,
                        gpuLayers: 0,
                        isHardwareCalibrated: true
                    });
                }
            },

            // AUTO-PROBE: Automatically fetches hardware specs and passes them to the calibrator
            autoCalibrateHardware: async () => {
                if (get().isHardwareCalibrated) return;

                console.log("[Hardware Watchdog] Initiating dynamic calibration sequence...");

                if (Platform.OS === 'web') {
                    console.log("[Hardware Watchdog] Web Gateway detected. Max context unlocked.");
                    get().calibrateHardwareEngine(32); // Pass arbitrary large RAM for web
                    return;
                }

                try {
                    // Extract exact physical RAM
                    const totalMemoryBytes = await Device.totalMemory;
                    // Fallback to 8GB if undefined
                    const ramInBytes = totalMemoryBytes || 8589934592;
                    const ramInGb = ramInBytes / (1024 * 1024 * 1024);

                    console.log(`[Hardware Watchdog] Native Device Probe: ~${ramInGb.toFixed(1)}GB RAM Detected.`);
                    get().calibrateHardwareEngine(ramInGb);

                } catch (error) {
                    console.error("[Hardware Watchdog] Probe failed. Applying safe defaults.", error);
                    get().calibrateHardwareEngine(8); // Fallback to 8GB standard profile
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