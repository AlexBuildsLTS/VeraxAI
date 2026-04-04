/**
 * _shared/supabaseAdmin.ts
 * Service role Supabase client for Edge Functions
 */
/// <reference lib="deno.window" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service_role privileges.
 * Use this for operations that need to bypass RLS.
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
