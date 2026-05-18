import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { consumeReturnTo } from "@/contexts/AuthContext";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

/**
 * AuthCallback — handles the redirect from Google OAuth.
 *
 * Flow:
 * 1. User clicks "Continue with Google" → signInWithOAuth redirects to Google
 * 2. Google redirects back to /auth/callback
 * 3. Supabase exchanges the PKCE code for a session automatically
 * 4. onAuthStateChange fires with SIGNED_IN
 * 5. We read the saved returnTo from sessionStorage and navigate there.
 *    Falls back to /dashboard if nothing was saved.
 *
 * Works in Replit preview and Vercel because the redirect URL is constructed
 * from window.location.origin + BASE_URL at the time signInWithGoogle is called.
 */
export default function AuthCallback() {
  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

    function navigateTo(appRelativePath: string) {
      // appRelativePath is relative to the app root (e.g. "/scan", "/dashboard")
      window.location.replace(`${window.location.origin}${base}${appRelativePath}`);
    }

    function getDestination(): string {
      const returnTo = consumeReturnTo();
      // Validate: must be a relative path starting with /
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        return returnTo;
      }
      return "/dashboard";
    }

    // If Supabase already has a session (e.g. user revisited an older link),
    // send them to their destination immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigateTo(getDestination());
        return;
      }

      // Wait for Supabase to finish the PKCE exchange.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          subscription.unsubscribe();
          navigateTo(getDestination());
        } else if (event === "SIGNED_OUT") {
          subscription.unsubscribe();
          navigateTo("/");
        }
      });

      // Timeout safety net — if nothing fires within 8 seconds, go home.
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        navigateTo("/");
      }, 8_000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center gap-5"
      >
        <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <p className="text-white font-semibold">Signing you in…</p>
          <p className="text-slate-500 text-sm">You'll be redirected automatically.</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-emerald-700"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
