import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

type Status = "loading" | "error";

/**
 * Auth callback page — landed here after Google OAuth or magic-link click.
 *
 * Supabase JS v2 automatically exchanges the code/hash in the URL for a session
 * as soon as the client initialises on this page. We just need to:
 *  1. Wait for the SIGNED_IN event on the auth state listener.
 *  2. Redirect the user to /dashboard via a full page navigation so the SPA
 *     router re-initialises with a clean URL (no leftover ?code= or #access_token).
 *
 * Using window.location.replace() (not wouter navigate) ensures the auth
 * parameters are stripped from the URL and browser history.
 */
export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let settled = false;

    function redirectToDashboard() {
      if (settled) return;
      settled = true;
      // Full navigation — clears the OAuth code/hash from the URL bar cleanly.
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      window.location.replace(`${window.location.origin}${base}/dashboard`);
    }

    function redirectToHome() {
      if (settled) return;
      settled = true;
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      window.location.replace(`${window.location.origin}${base}/`);
    }

    // Check whether the session is already available (e.g. user refreshed the
    // callback page, or Supabase exchanged the code synchronously).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectToDashboard();
        return;
      }

      // Listen for the session being established after the PKCE code exchange.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          subscription.unsubscribe();
          redirectToDashboard();
        } else if (event === "SIGNED_OUT") {
          subscription.unsubscribe();
          redirectToHome();
        }
      });

      // Safety net — if nothing fires in 10 seconds, show an error state.
      const timeout = setTimeout(() => {
        if (!settled) {
          subscription.unsubscribe();
          setStatus("error");
        }
      }, 10_000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    });
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center gap-5 max-w-sm"
        >
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <p className="text-white font-semibold text-lg">Sign-in timed out</p>
            <p className="text-slate-500 text-sm leading-relaxed">
              We couldn't complete sign-in. This can happen if the link expired
              or the session wasn't established. Please try again.
            </p>
          </div>
          <button
            onClick={() => { window.location.replace("/"); }}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

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
          <p className="text-white font-semibold text-lg">Signing you in...</p>
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
