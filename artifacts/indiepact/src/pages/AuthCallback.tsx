import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

/**
 * AuthCallback — handles the redirect from Google OAuth.
 *
 * Flow:
 * 1. User clicks "Continue with Google" → signInWithOAuth redirects to Google
 * 2. Google redirects back to this page (/auth/callback)
 * 3. Supabase exchanges the PKCE code for a session automatically
 * 4. onAuthStateChange fires with SIGNED_IN → we redirect to /dashboard
 *
 * If no session is established within 5 seconds, we fall back to home.
 */
export default function AuthCallback() {
  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

    function toDashboard() {
      window.location.replace(`${window.location.origin}${base}/dashboard`);
    }

    function toHome() {
      window.location.replace(`${window.location.origin}${base}/`);
    }

    // If there is already an active session (e.g. user clicked an older link
    // and Supabase exchanged it), send them straight to the dashboard.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        toDashboard();
        return;
      }

      // Listen in case Supabase is mid-exchange (PKCE flow from an old link).
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          subscription.unsubscribe();
          toDashboard();
        } else if (event === "SIGNED_OUT") {
          subscription.unsubscribe();
          toHome();
        }
      });

      // If nothing fires in 5 seconds, give up and go home.
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        toHome();
      }, 5_000);

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
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
            border: "1px solid rgba(16,185,129,0.3)",
            boxShadow: "0 0 32px rgba(16,185,129,0.15)",
          }}
        >
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <p className="text-white font-semibold text-lg">Signing you in…</p>
          <p className="text-slate-500 text-sm">You'll be redirected automatically.</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
