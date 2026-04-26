import { requireNativeModule } from 'expo-modules-core';

const LiteRTNative = requireNativeModule('LiteRT');

export async function initModel(modelPath: string, maxTokens: number, temperature: number): Promise<boolean> {
  return await LiteRTNative.initModel(modelPath, maxTokens, temperature);
}

export async function generateResponse(prompt: string): Promise<string> {
  return await LiteRTNative.generateResponse(prompt);
}