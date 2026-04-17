/**
 * lib/supabase/client.ts
 * VeraxAI- Production Supabase Client
 */
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { ExpoSecureStoreAdapter } from './secureStorage';
import { Database } from '../../types/database/database.types';



// 2. Grab the raw environment variables
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jhcgkqzjabsitfilajuh.supabase.co';
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoY2drcXpqYWJzaXRmaWxhanVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTUxOTIsImV4cCI6MjA4OTQzMTE5Mn0.5tTsWTYNzDOyf6Evf2EXiJ2dhvpuRfixuGiMt1evHgA';

// 3. CRITICAL ANDROID FIX: The nuclear option for string cleaning.
// Removes all spaces, newlines, and accidental quotes.
let supabaseUrl = rawUrl.replace(/[\s\n\r'"]/g, '').replace(/\/$/, '');
const supabaseAnonKey = rawKey.replace(/[\s\n\r'"]/g, '');

// 4. THE KILLSWITCH: Fallback protection
if (!supabaseUrl.includes('supabase.co')) {
  if (__DEV__) console.warn(`[Supabase Client] ⚠️ Env URL poisoned. Forcing database endpoint.`);
  supabaseUrl = 'https://jhcgkqzjabsitfilajuh.supabase.co';
}

if (__DEV__) {
  console.log(`[Supabase Client] 🚀 Initializing for ${Platform.OS} at ${supabaseUrl}`);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing! Check .env and app.json. ' +
      'The app may crash or fail to connect.',
  );
}

// 5. Initialize Client safely
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Production standard: On native, use Expo Secure Store. On web, use default localStorage.
    storage: Platform.OS !== 'web' ? ExpoSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    // Detect session in URL must be true on Web to parse Google OAuth and Email links
    detectSessionInUrl: Platform.OS === 'web',
  },
});