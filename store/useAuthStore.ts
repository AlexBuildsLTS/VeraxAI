/**
 * store/useAuthStore.ts
 * Enterprise Authentication State Manager
 * ----------------------------------------------------------------------------
 * FEATURES:
 * 1. Deep Session Initialization: Prevents layout thrashing during boot.
 * 2. Strict Type Safety: Mapped directly to Supabase Auth interfaces.
 * 3. Error Boundaries: Standardized error returns for the UI to consume safely.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  // Core State
  user: User | null;
  session: Session | null;
  isLoading: boolean;

  // Auth Actions
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // Lifecycle
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  signInWithMagicLink: async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'transcriber-pro://dashboard',
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[AUTH:OTP_FAIL]', err.message);
      return { error: err.message || 'Failed to send magic link.' };
    }
  },

  signInWithPassword: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Eagerly set state for instant UI response
      set({ session: data.session, user: data.user });
      return { error: null };
    } catch (err: any) {
      console.error('[AUTH:SIGN_IN_FAIL]', err.message);
      return { error: err.message || 'Invalid login credentials.' };
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: 'transcriber-pro://dashboard',
        },
      });
      if (error) throw error;

      // Eagerly set state if auto-confirm is enabled
      if (data.session) {
        set({ session: data.session, user: data.user });
      }
      return { error: null };
    } catch (err: any) {
      console.error('[AUTH:SIGN_UP_FAIL]', err.message);
      return { error: err.message || 'Registration failed.' };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error('[AUTH:SIGN_OUT_FAIL] Non-fatal:', err.message);
    } finally {
      // Always clear local state even if server fails
      set({ user: null, session: null });
    }
  },

  initialize: () => {
    // 1. Initial Session Fetch
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('[AUTH:INIT_ERROR]', error.message);
      set({
        session,
        user: session?.user ?? null,
        isLoading: false
      });
    });

    // 2. Real-time Subscription (Handles token refreshes and multi-tab logins)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false
      });
    });
  },
}));