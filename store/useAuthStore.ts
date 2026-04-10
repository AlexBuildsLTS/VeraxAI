/**
 * store/useAuthStore.ts
 * Verbum NorthOS - Enterprise Authentication State Manager (Production Ready)
 * Architecture: 2026 High-Performance Standards (Web & Native APK)
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { Database } from '../types/database/database.types';
import { Platform } from 'react-native';

/**
 * [CRITICAL ROUTER LOCK]
 * When 'Confirm Email' is disabled in Supabase, signing up auto-triggers a SIGNED_IN event.
 * This lock completely blinds the Zustand store from broadcasting that temporary session to 
 * the Expo Router. This physically prevents the "black screen blink" layout crash on Web.
 */
let isRegisteringLock = false;

/**
 * [MODULE: TYPE DEFINITIONS]
 * Maps the exact Supabase generated schema. Note: NO username column per your schema.
 */
type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  initialize: () => () => void;
  clearError: () => void;
}

const interceptAuthError = (err: any, defaultMessage: string): string => {
  const msg = err?.message || '';

  if (msg.includes('Unexpected character: <') || msg.includes('JSON Parse error')) {
    if (__DEV__) console.warn('[Auth Interceptor] ⚠️ Received HTML instead of JSON. Check network routing.');
    return 'Network Protocol Error: The authentication gateway is misconfigured. Please verify the connection.';
  }

  if (msg.includes('unexpected_failure') || msg.includes('500')) {
    if (__DEV__) console.error('[Auth Interceptor] 🚨 Backend Trigger Failure:', msg);
    return 'System fault: Identity generation failed on the server. Please check Supabase triggers.';
  }

  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    if (__DEV__) console.error('[Auth Interceptor] 🌐 Network Connectivity Issue:', msg);
    return 'Neural link failed. The application cannot reach the authentication server. Please check your internet connection.';
  }

  return msg || defaultMessage;
};

/**
 * [MODULE: URL SANITIZER]
 * CRITICAL ANDROID FIX: Ensures the Supabase URL string is free of any invisible characters
 * that cause the native Android OkHttp client to instantly crash.
 */
const sanitizeUrl = (url: string | undefined): string => {
  if (!url) return 'https://jhcgkqzjabsitfilajuh.supabase.co';
  return url.replace(/[\s\n\r]+$/g, '').replace(/\/$/, '');
};

/**
 * [MODULE: CORE STATE MANAGER]
 * Orchestrates all identity lifecycles securely across Web and APK environments.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,
  isInitialized: false,

  clearError: () => set({ error: null }),

  signInWithPassword: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    if (__DEV__) console.log(`[Auth Store] 🔐 Attempting sign-in: ${email}`);

    try {
      const safeUrl = sanitizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
      if (__DEV__ && Platform.OS !== 'web') {
        console.log(`[Auth Store] Native URL Check: ->${safeUrl}<-`);
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      if (__DEV__) console.log(`[Auth Store] ✅ Sign-in successful: ${data.user?.email}`);

      set({ session: data.session, user: data.user });
      await get().refreshProfile();

      return { error: null };
    } catch (err: unknown) {
      const mappedError = interceptAuthError(err, 'Invalid credentials.');
      set({ error: mappedError, isLoading: false });
      return { error: mappedError };
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    // 1. ENGAGE THE ROUTER LOCK
    isRegisteringLock = true;
    set({ isLoading: true, error: null });

    if (__DEV__) console.log(`[Auth Store] 📝 Attempting sign-up: ${email}`);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined
        },
      });

      if (error) throw error;

      if (__DEV__) console.log(`[Auth Store] 📬 Sign-up request processed.`);

      // 2. SILENT PURGE (Blocked from UI by the lock)
      if (data.session) {
        if (__DEV__) console.log('[Auth Store] 🛡️ Auto-session detected. Purging...');
        // We can safely await this now because the UI layout is blindfolded by isRegisteringLock
        await supabase.auth.signOut();
      }

      return { error: null };
    } catch (err: unknown) {
      const mappedError = interceptAuthError(err, 'Registration failed. Identity may already exist.');
      set({ error: mappedError, isLoading: false });
      return { error: mappedError };
    } finally {
      // 3. RELEASE THE LOCK and ensure state remains empty so the UI can play the animation
      isRegisteringLock = false;
      set({ session: null, user: null, isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      if (__DEV__) console.warn('[Auth Store] Sign out network error safely caught.');
    } finally {
      set({ user: null, session: null, profile: null, error: null, isLoading: false });
    }
  },

  refreshProfile: async () => {
    const { session } = get();
    const userId = session?.user?.id;

    if (!userId) {
      // APK FIX: Guarantee isLoading becomes false if no user is found so the boot splash drops
      set({ profile: null, isLoading: false });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (__DEV__) console.warn(`[Auth Kernel] ⚠️ Sync Error: ${error.message}`);
        // APK FIX: Guarantee isLoading becomes false even on DB error
        set({ error: interceptAuthError(error, 'Profile sync failed.'), isLoading: false });
        return;
      }

      if (data) {
        set({ profile: data as Profile, error: null, isLoading: false });
      } else {
        if (__DEV__) console.log('[Auth Kernel] ⏳ Profile propagating, polling in 1s...');
        setTimeout(() => get().refreshProfile(), 1000);
      }
    } catch (err: unknown) {
      if (__DEV__) console.warn('[Auth Kernel] 🚨 Non-fatal Store Error:', err);
      // APK FIX: Guarantee isLoading becomes false on critical crash
      set({ profile: null, isLoading: false, error: interceptAuthError(err, 'Critical sync failure') });
    }
  },

  initialize: () => {
    if (__DEV__) console.log('[Auth Kernel] 🚀 Initializing Auth Matrix...');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        if (__DEV__) console.warn('[Auth Kernel] Expected Session Boundary:', error.message);
      }

      set({ session, user: session?.user ?? null, isInitialized: true });

      if (session?.user) {
        get().refreshProfile();
      } else {
        // APK FIX: If guest, immediately drop the loading state to dismiss the boot splash
        set({ isLoading: false });
      }
    }).catch(err => {
      if (__DEV__) console.warn('[Auth Kernel] Initialization trap caught:', err?.message);
      set({ isInitialized: true, isLoading: false, session: null, user: null });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 🚫 THE INTERCEPTOR: Completely blind the store while the SignUp lock is active!
      if (isRegisteringLock) {
        if (__DEV__) console.log(`[Auth Kernel] 🔒 Ignoring Event during signup lock: ${event}`);
        return;
      }

      if (__DEV__) console.log(`[Auth Kernel] ⚡ Event Dispatch: ${event}`);

      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        if (__DEV__) console.log('[Auth Kernel] Token expired. Dropping to guest state.');
        set({ session: null, user: null, profile: null, isLoading: false });
        return;
      }

      set({ session, user: session?.user ?? null });

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        get().refreshProfile();
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null, isLoading: false, error: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },
}));