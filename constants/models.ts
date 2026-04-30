/**
 * constants/models.ts
 * Shared Model Definitions for Local AI
 */

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

export const AVAILABLE_MODELS: LocalModel[] = [
  {
    id: 'gemma-4-e2b-it-unsloth',
    name: 'Gemma-4 E2B-it (Q4_K_XL)',
    sizeGb: 2.5,
    minRamGb: 4,
    isUncensored: false,
    tags: ['E2B', 'GGUF', 'UNSLOTH'],
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-UD-Q4_K_XL.gguf',
    fileName: 'gemma-4-E2B-it-UD-Q4_K_XL.gguf',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 32.5,
      promptEvalMs: 120,
      memoryBandwidth: 'Low',
    },
    description:
      'Unsloth optimized Q4 quantization. Perfect for fast JSON generation on mobile hardware.',
  },
  {
    id: 'gemma-4-e4b-it-unsloth',
    name: 'Gemma-4 E4B-it (Q4_K_M)',
    sizeGb: 3.6,
    minRamGb: 8,
    isUncensored: false,
    tags: ['E4B', 'GGUF', 'UNSLOTH'],
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf',
    fileName: 'gemma-4-E4B-it-Q4_K_M.gguf',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 18.2,
      promptEvalMs: 380,
      memoryBandwidth: 'Medium',
    },
    description:
      'Unsloth optimized Q4 quantization. Superior reasoning for long context transcripts.',
  },
];
