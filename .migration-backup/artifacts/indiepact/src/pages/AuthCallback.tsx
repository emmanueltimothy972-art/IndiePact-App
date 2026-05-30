import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { consumeReturnTo } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// AuthCallback — landing page for Google OAuth redirects.
//
// Flow (happy path):
//  1. signInWithOAuth redirects to Google with PKCE code_challenge
//  2. Google redirects to GET /api/auth/callback?code=...&state=...
//  3. Express forwards code+state to this page at <base>/auth/callback
//  4. Supabase JS (detectSessionInUrl:true + flowType:"pkce") exchanges the
//     code using the stored code_verifier, validates state, fires SIGNED_IN
//  5. onAuthStateChange → we navigate to the returnTo destination
//
// Error paths routed here by the Express callback:
//  • access_denied  — user cancelled the Google consent screen
//  • missing_code   — callback arrived without a code (misconfiguration)
//  • Any other provider error string
//
// CUSTOM DOMAIN MIGRATION CHECKLIST
//  1. Supabase Dashboard → Authentication → URL Configuration
//     • Site URL:       https://indiepact.pro
//     • Redirect URLs:  https://indiepact.pro/api/auth/callback
//                       https://indiepact.pro/auth/callback
//  2. Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
//     • https://indiepact.pro/api/auth/callback
//     • https://<project>.supabase.co/auth/v1/callback  (keep for OTP)
//  3. Google Cloud Console → Authorized JavaScript origins
//     • https://indiepact.pro
//  4. Google Cloud Console → OAuth Consent Screen → App name → "IndiePact"
// ─────────────────────────────────────────────────────────────────────────────

type CallbackState = "loading" | "error";

interface ErrorInfo {
  heading: string;
  body: string;
  recoverable: boolean;
}

function describeError(errorCode: string, description: string | null): ErrorInfo {
  switch (errorCode) {
    case "access_denied":
      return {
        heading: "Sign-in cancelled",
        body: "You closed the Google sign-in window. No worries — you can try again whenever you're ready.",
        recoverable: true,
      };
    case "missing_code":
      return {
        heading: "Something went wrong",
        body: "The sign-in flow didn't complete correctly. This is usually a temporary issue — please try again.",
        recoverable: true,
      };
    case "timeout":
      return {
        heading: "Sign-in timed out",
        body: "The session took too long to establish. This can happen on slow connections — please try again.",
        recoverable: true,
      };
    default:
      return {
        heading: "Sign-in failed",
        body: description ?? "Google returned an error during sign-in. Please try again or use a different sign-in method.",
        recoverable: true,
      };
  }
}

// ─── Brand mark ───────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div
      className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0f1f18] to-[#0a1510] border border-emerald-900/40 flex items-center justify-center"
      style={{ boxShadow: "0 0 0 1px rgba(16,185,129,0.07), 0 8px 32px rgba(0,0,0,0.7)" }}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="5" y="3" width="16" height="20" rx="2.5" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="8.5" y1="8.5" x2="17.5" y2="8.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4" />
        <line x1="8.5" y1="11.5" x2="17.5" y2="11.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4" />
        <line x1="8.5" y1="14.5" x2="13.5" y2="14.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4" />
        <path d="M12.5 18.5l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthCallback() {
  const [state, setState] = useState<CallbackState>("loading");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

    // ── Check for error params from the Express callback relay ───────────────
    // The Express GET /api/auth/callback route forwards provider errors here
    // instead of the home page, so we can show a contextual recovery UI.
    const searchParams = new URLSearchParams(window.location.search);
    const errorCode = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorCode) {
      setErrorInfo(describeError(errorCode, errorDescription));
      setState("error");
      return;
    }

    // ── Happy path: wait for Supabase to exchange the PKCE code ─────────────
    // detectSessionInUrl:true causes the Supabase client to call
    // exchangeCodeForSession automatically when it sees ?code= in the URL.
    // We listen for the resulting SIGNED_IN event.

    let authSub: { unsubscribe: () => void } | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    function navigateTo(appRelativePath: string) {
      settled = true;
      window.location.replace(`${window.location.origin}${base}${appRelativePath}`);
    }

    function getDestination(): string {
      const returnTo = consumeReturnTo();
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        return returnTo;
      }
      return "/dashboard";
    }

    function handleTimeout() {
      if (settled) return;
      authSub?.unsubscribe();
      setErrorInfo(describeError("timeout", null));
      setState("error");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;

      if (session) {
        navigateTo(getDestination());
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          if (timeoutId) clearTimeout(timeoutId);
          subscription.unsubscribe();
          navigateTo(getDestination());
        } else if (event === "SIGNED_OUT") {
          if (timeoutId) clearTimeout(timeoutId);
          subscription.unsubscribe();
          navigateTo("/");
        }
      });

      authSub = subscription;
      timeoutId = setTimeout(handleTimeout, 10_000);
    });

    return () => {
      settled = true;
      authSub?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  function handleRetry() {
    window.location.replace(`${window.location.origin}${base}/`);
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">

      {/* ── Ambient background glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: state === "error"
            ? "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(239,68,68,0.03) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(16,185,129,0.04) 0%, transparent 70%)",
        }}
      />

      {/* ── Top progress bar (loading only) ── */}
      {state === "loading" && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }}
          />
        </div>
      )}

      <motion.div
        key={state}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center text-center gap-6 px-8 max-w-sm w-full"
      >

        {state === "loading" && (
          <>
            <BrandMark />

            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold text-white tracking-tight">IndiePact</p>
              <p className="text-slate-400 text-sm font-medium">Signing you in…</p>
              <p className="text-slate-600 text-xs">You'll be redirected automatically.</p>
            </div>

            <div className="flex gap-1.5 pt-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-1 w-1 rounded-full bg-emerald-700"
                  animate={{ opacity: [0.25, 0.9, 0.25], scale: [0.75, 1, 0.75] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </>
        )}

        {state === "error" && errorInfo && (
          <>
            {/* Error icon badge */}
            <div className="h-14 w-14 rounded-2xl bg-red-950/30 border border-red-900/40 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>

            {/* Text */}
            <div className="space-y-2">
              <p className="text-[15px] font-semibold text-white tracking-tight">
                {errorInfo.heading}
              </p>
              <p className="text-slate-400 text-sm leading-relaxed">
                {errorInfo.body}
              </p>
            </div>

            {/* Inline error panel */}
            <div className="w-full flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-950/25 border border-red-900/30">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
              <p className="text-red-400/90 text-xs leading-relaxed text-left">
                If this keeps happening, try signing in with your email instead — it uses a 6-digit code and never requires Google.
              </p>
            </div>

            {/* Recovery button */}
            {errorInfo.recoverable && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                  bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500
                  transition-all active:scale-[0.98] shadow-lg shadow-emerald-950/40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try signing in again
              </button>
            )}

            {/* Brand footer */}
            <p className="text-slate-700 text-xs">IndiePact · Legal AI for Founders</p>
          </>
        )}

      </motion.div>
    </div>
  );
}
