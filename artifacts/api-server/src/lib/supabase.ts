import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

const isMisconfigured = !supabaseUrl || !supabaseServiceRoleKey;

if (isMisconfigured) {
  console.warn(
    "[IndiePact API] Supabase credentials are not configured.\n" +
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.\n" +
    "Database operations will fail gracefully until credentials are provided."
  );
}

// Only create the real client when credentials are present.
export const supabase: SupabaseClient | null = isMisconfigured
  ? null
  : createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw Object.assign(
      new Error("Database is temporarily unavailable — Supabase credentials not configured."),
      { statusCode: 503 }
    );
  }
  return supabase;
}
