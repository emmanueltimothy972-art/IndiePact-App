import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isMisconfigured = !supabaseUrl || !supabaseAnonKey;

if (isMisconfigured) {
  console.warn(
    "[IndiePact] Supabase credentials are not configured.\n" +
    "Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables to enable auth.\n" +
    "The app will run in guest-only mode until credentials are provided."
  );
}

// Only create the real client when credentials are present.
// When they're missing we provide a no-op stub so the app still boots.
export const supabase: SupabaseClient = isMisconfigured
  ? ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: (_event: unknown, _cb: unknown) => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        signInWithOAuth: async () => ({ data: null, error: new Error("Auth not configured") }),
        signInWithOtp: async () => ({ data: null, error: new Error("Auth not configured") }),
        signOut: async () => ({ error: null }),
      },
    } as unknown as SupabaseClient)
  : createClient(supabaseUrl!, supabaseAnonKey!);
