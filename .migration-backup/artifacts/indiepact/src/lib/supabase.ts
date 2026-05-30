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
 * Supabase client — handles Google OAuth and session management.
 *
 * Auth flow:
 * 1. User clicks "Continue with Google" → signInWithOAuth({ provider: 'google' })
 * 2. Supabase redirects to Google, then back to /auth/callback
 * 3. AuthCallback.tsx detects the session via onAuthStateChange → redirects to /dashboard
 * 4. AuthContext.onAuthStateChange fires globally → updates user state everywhere
 *
 * To enable Google OAuth: configure the Google provider in Supabase Dashboard
 * under Auth > Providers > Google, and add your Google OAuth client credentials.
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
        storageKey: "indiepact_auth",
        flowType: "pkce",
      },
    });
