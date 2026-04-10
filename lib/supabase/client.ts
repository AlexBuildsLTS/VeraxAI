/**
 * lib/supabase/client.ts
 * Verbum NorthOS - Production Supabase Client
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { ExpoSecureStoreAdapter } from './secureStorage';
import { Database } from '../../types/database/database.types';

// 1. Grab and AGGRESSIVELY SANITIZE the environment variables before anything else
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jhcgkqzjabsitfilajuh.supabase.co';
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoY2drcXpqYWJzaXRmaWxhanVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTUxOTIsImV4cCI6MjA4OTQzMTE5Mn0.5tTsWTYNzDOyf6Evf2EXiJ2dhvpuRfixuGiMt1evHgA';

// CRITICAL ANDROID FIX: This strips out all hidden EAS spaces/newlines that crash Android's OkHttp
let supabaseUrl = rawUrl.replace(/[\s\n\r]+$/g, '').replace(/\/$/, '');
const supabaseAnonKey = rawKey.replace(/[\s\n\r]+$/g, '');

// 2. THE KILLSWITCH:
// If your local .env accidentally injected the Vercel URL or localhost during build/update,
// this forces the app back to the true Supabase backend.
if (!supabaseUrl.includes('supabase.co')) {
  if (__DEV__) console.warn(`[Supabase Client] ⚠️ Env URL poisoned with: ${supabaseUrl}. Forcing database endpoint.`);
  supabaseUrl = 'https://jhcgkqzjabsitfilajuh.supabase.co';
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// 3. Initialize Client safely
if (__DEV__) {
  console.log(`[Supabase Client] 🚀 Initializing for ${Platform.OS} at ${supabaseUrl}`);
}
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Production standard: 
    // On native (iOS/Android), use Expo Secure Store.
    // On web, omit the storage key so Supabase uses its default browser storage.
    storage: Platform.OS !== 'web' ? ExpoSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});