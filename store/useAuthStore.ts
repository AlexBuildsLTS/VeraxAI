/**
 * store/useAuthStore.ts
 * VerbumAI - Authentication State Manager
 * WEB / APK
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { Database } from '../types/database/database.types';
import { Platform } from 'react-native';

/**
 * [CRITICAL ROUTER LOCK]
 * When 'Confirm Email' is disabled in Supabase, signing up auto-triggers a SIGNED_IN event.
 * This lock blinds the store from broadcasting that temporary session to Expo Router,
 * preventing the "black screen blink" layout crash on Web.
 */
let isRegisteringLock = false;

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
  refreshProfile: (retryCount?: number) => Promise<void>;
  initialize: () => () => void;
  clearError: () => void;
}

/**
 * Translates raw Supabase/network errors into user-facing messages.
 */
const interceptAuthError = (err: any, defaultMessage: string): string => {
  const msg = err?.message || '';

  if (msg.includes('Unexpected character: <') || msg.includes('JSON Parse error')) {
    if (__DEV__) console.warn('[Auth Interceptor] ⚠️ Received HTML instead of JSON.');
    return 'Network Protocol Error: The authentication gateway is misconfigured.';
  }
  if (msg.includes('unexpected_failure') || msg.includes('500')) {
    if (__DEV__) console.error('[Auth Interceptor] 🚨 Backend Trigger Failure:', msg);
    return 'System fault: Identity generation failed on the server.';
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    if (__DEV__) console.error('[Auth Interceptor] 🌐 Network Issue:', msg);
    return 'Neural link failed. Cannot reach the authentication server.';
  }

  return msg || defaultMessage;
};

/**
 * Strips invisible characters from env URLs that crash Android OkHttp.
 */
const sanitizeUrl = (url: string | undefined): string => {
  if (!url) return 'https://jhcgkqzjabsitfilajuh.supabase.co';
  return url.replace(/[\s\n\r]+$/g, '').replace(/\/$/, '');
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,
  isInitialized: false,

  clearError: () => set({ error: null }),

  /**
   * Email/password sign-in.
   * CRITICAL APK FIX: A 3-second hard timeout guarantees isLoading becomes false
   * even if refreshProfile loops or hangs — preventing infinite splash on Android.
   */
  signInWithPassword: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    if (__DEV__) console.log(`[Auth Store] 🔐 Attempting sign -in: ${email} `);

    try {
      const safeUrl = sanitizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
      if (__DEV__ && Platform.OS !== 'web') {
        console.log(`[Auth Store] Native URL Check: -> ${safeUrl} <-`);
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (__DEV__) console.log(`[Auth Store] ✅ Sign -in successful: ${data.user?.email} `);

      set({ session: data.session, user: data.user });

      // Hard timeout: if profile fetch hangs for any reason, release the loading lock
      // so _layout.tsx routing fires correctly on APK.
      const profileTimeout = setTimeout(() => {
        if (__DEV__) console.warn('[Auth Store] ⏱️ Profile timeout — forcing isLoading: false');
        set({ isLoading: false });
      }, 3000);

      await get().refreshProfile();
      clearTimeout(profileTimeout);

      return { error: null };
    } catch (err: unknown) {
      const mappedError = interceptAuthError(err, 'Invalid credentials.');
      set({ error: mappedError, isLoading: false });
      return { error: mappedError };
    }
  },

  /**
   * Email/password registration.
   * Router lock prevents the auto SIGNED_IN event from routing mid-signup.
   */
  signUp: async (email: string, password: string, fullName: string) => {
    isRegisteringLock = true;
    set({ isLoading: true, error: null });
    if (__DEV__) console.log(`[Auth Store] 📝 Attempting sign - up: ${email} `);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
        },
      });

      if (error) throw error;

      if (__DEV__) console.log(`[Auth Store] 📬 Sign - up processed.`);

      // Purge the auto-session silently — UI is blindfolded by the lock
      if (data.session) {
        if (__DEV__) console.log('[Auth Store] 🛡️ Auto-session detected. Purging...');
        await supabase.auth.signOut();
      }

      return { error: null };
    } catch (err: unknown) {
      const mappedError = interceptAuthError(err, 'Registration failed. Identity may already exist.');
      set({ error: mappedError, isLoading: false });
      return { error: mappedError };
    } finally {
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

  /**
   * Fetches the user profile from Supabase.
   * CRITICAL APK FIX: Limited to 3 retries maximum. Previously looped infinitely,
   * which kept isLoading: true forever and prevented _layout.tsx routing from firing.
   */
  refreshProfile: async (retryCount = 0) => {
    const { session } = get();
    const userId = session?.user?.id;

    if (!userId) {
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
        if (__DEV__) console.warn(`[Auth Kernel] ⚠️ Sync Error: ${error.message} `);
        set({ error: interceptAuthError(error, 'Profile sync failed.'), isLoading: false });
        return;
      }

      if (data) {
        set({ profile: data as Profile, error: null, isLoading: false });
      } else if (retryCount < 3) {
        // Profile may not have propagated yet — retry with backoff
        if (__DEV__) console.log(`[Auth Kernel] ⏳ Profile propagating, retry ${retryCount + 1}/3...`);
        setTimeout(() => get().refreshProfile(retryCount + 1), 1000);
      } else {
        // Profile never arrived — let the user in anyway, profile is non-critical for routing
        if (__DEV__) console.warn('[Auth Kernel] ⚠️ Profile not found after 3 retries. Proceeding.');
        set({ isLoading: false });
      }
    } catch (err: unknown) {
      if (__DEV__) console.warn('[Auth Kernel] 🚨 Non-fatal Store Error:', err);
      set({ profile: null, isLoading: false, error: interceptAuthError(err, 'Critical sync failure') });
    }
  },

  /**
   * Bootstraps the auth session on app launch.
   * Reads persisted session from SecureStore (native) or localStorage (web),
   * then subscribes to all future auth state changes.
   */
  initialize: () => {
    if (__DEV__) console.log('[Auth Kernel] 🚀 Initializing Auth Matrix...');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        if (__DEV__) console.warn('[Auth Kernel] Session boundary:', error.message);
      }

      set({ session, user: session?.user ?? null, isInitialized: true });

      if (session?.user) {
        get().refreshProfile();
      } else {
        set({ isLoading: false });
      }
    }).catch(err => {
      if (__DEV__) console.warn('[Auth Kernel] Initialization trap caught:', err?.message);
      set({ isInitialized: true, isLoading: false, session: null, user: null });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Blind the store during signup to prevent premature routing
      if (isRegisteringLock) {
        if (__DEV__) console.log(`[Auth Kernel] 🔒 Ignoring event during signup lock: ${event}`);
        return;
      }

      if (__DEV__) console.log(`[Auth Kernel] ⚡ Event: ${event}`);

      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
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

    return () => subscription.unsubscribe();
  },
}));
