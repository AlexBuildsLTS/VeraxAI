import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * ============================================================================
 * 🔐 SECURE STORAGE ADAPTER — CHUNKED (fixes 2048 byte Android limit)
 * ============================================================================
 * Supabase sessions exceed 2048 bytes. SecureStore silently fails or throws
 * on Android when value > 2048 bytes. This adapter chunks large values across
 * multiple keys and reassembles them on read.
 * ============================================================================
 */

const CHUNK_SIZE = 1800; // Stay safely under 2048 byte limit
const CHUNK_COUNT_SUFFIX = '__CHUNKS';

const isWeb = Platform.OS === 'web';
const isBrowser = typeof window !== 'undefined';

async function setChunked(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    // Small enough — store directly, clean up any old chunks
    await SecureStore.setItemAsync(key, value);
    await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(() => { });
    return;
  }

  // Split into chunks
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }

  // Store each chunk
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(`${key}_chunk_${index}`, chunk)
    )
  );

  // Store chunk count so we know how many to read back
  await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(chunks.length));

  // Clean up any old non-chunked value
  await SecureStore.deleteItemAsync(key).catch(() => { });
}

async function getChunked(key: string): Promise<string | null> {
  // Check if chunked version exists
  const chunkCountStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);

  if (!chunkCountStr) {
    // Not chunked — read directly
    return SecureStore.getItemAsync(key);
  }

  const chunkCount = parseInt(chunkCountStr, 10);
  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) =>
      SecureStore.getItemAsync(`${key}_chunk_${i}`)
    )
  );

  // If any chunk is missing, session is corrupt — return null to force re-login
  if (chunks.some((chunk) => chunk === null)) {
    return null;
  }

  return chunks.join('');
}

async function deleteChunked(key: string): Promise<void> {
  const chunkCountStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);

  if (chunkCountStr) {
    const chunkCount = parseInt(chunkCountStr, 10);
    await Promise.all([
      ...Array.from({ length: chunkCount }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => { })
      ),
      SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(() => { }),
    ]);
  }

  await SecureStore.deleteItemAsync(key).catch(() => { });
}

export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) {
      if (!isBrowser) return null;
      return localStorage.getItem(key);
    }
    try {
      return await getChunked(key);
    } catch (e) {
      console.warn('[SecureStore] getItem failed:', key, e);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      if (!isBrowser) return;
      localStorage.setItem(key, value);
      return;
    }
    try {
      await setChunked(key, value);
    } catch (e) {
      console.warn('[SecureStore] setItem failed:', key, e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (isWeb) {
      if (!isBrowser) return;
      localStorage.removeItem(key);
      return;
    }
    try {
      await deleteChunked(key);
    } catch (e) {
      console.warn('[SecureStore] removeItem failed:', key, e);
    }
  },
};

export default ExpoSecureStoreAdapter;