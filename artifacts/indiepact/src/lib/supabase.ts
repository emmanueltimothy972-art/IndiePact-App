import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isMisconfigured = !supabaseUrl || !supabaseAnonKey;

if (isMisconfigured) {
  console.warn(
    "[IndiePact] Supabase credentials are not configured.\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables to enable auth.\n" +
    "The app will run in guest-only mode until credentials are provided."
  );
}

/**
 * Supabase client — used for all auth operations (OTP send + verify) and
 * database queries from the frontend.
 *
 * Email delivery is handled by Supabase Auth. To switch to a custom SMTP
 * provider (Resend, Postmark, etc.) configure it in the Supabase dashboard
 * under Auth > SMTP Settings — no code changes are needed here.
 */
export const supabase: SupabaseClient = isMisconfigured
  ? ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: (_event: unknown, _cb: unknown) => ({
          data: { subscription: { unsubscribe: () => {} } },
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
      },
    });
