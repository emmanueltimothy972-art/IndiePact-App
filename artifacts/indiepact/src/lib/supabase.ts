import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isMisconfigured = !supabaseUrl || !supabaseAnonKey;

if (isMisconfigured) {
  console.warn(
    "[IndiePact] Supabase credentials are not configured.\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth.\n" +
    "The app will run in guest-only mode until credentials are provided."
  );
}

/**
 * Supabase client — handles passwordless OTP auth and session management.
 *
 * Auth flow:
 * 1. User enters email → supabase.auth.signInWithOtp sends a 6-digit code
 * 2. User enters code → supabase.auth.verifyOtp exchanges it for a session
 * 3. AuthContext.onAuthStateChange fires globally → updates user state everywhere
 *
 * Session persistence:
 * - persistSession: true   — JWT stored in localStorage across reloads
 * - autoRefreshToken: true — refreshed silently before expiry
 * - storageKey: 'indiepact-secure-session' — stable key for all environments
 */
export const supabase: SupabaseClient = isMisconfigured
  ? ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: (_event: unknown, _cb: unknown) => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        signInWithOAuth: async () => ({
          data: null,
          error: new Error("Auth not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"),
        }),
        signInWithOtp: async () => ({ data: null, error: new Error("Auth not configured") }),
        verifyOtp: async () => ({ data: null, error: new Error("Auth not configured") }),
        signOut: async () => ({ error: null }),
      },
    } as unknown as SupabaseClient)
  : createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "indiepact-secure-session",
        flowType: "pkce",
      },
    });
