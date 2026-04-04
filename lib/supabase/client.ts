import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { ExpoSecureStoreAdapter } from './secureStorage';
import { Database } from '../../types/database/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Production standard: 
    // On native (iOS/Android), use Expo Secure Store.
    // On web, omit the storage key to let Supabase use its highly-tested default browser storage.
    ...(Platform.OS !== 'web' ? { storage: ExpoSecureStoreAdapter } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});