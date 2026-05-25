import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { consumeReturnTo } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// AuthCallback — handles the redirect landing page from Google OAuth.
//
// Flow:
//  1. User clicks "Continue with Google" → signInWithOAuth redirects to Google
//  2. Google redirects back to /api/auth/callback (Express) which forwards the
//     PKCE code to this frontend page at <base>/auth/callback
//  3. Supabase JS exchanges the PKCE code for a session automatically
//  4. onAuthStateChange fires with SIGNED_IN
//  5. We read the saved returnTo from sessionStorage and navigate there.
//     Falls back to /dashboard if nothing was saved.
//
// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM DOMAIN MIGRATION CHECKLIST
// When IndiePact moves to a custom .pro domain, update the following:
//
//  1. Supabase Dashboard → Authentication → URL Configuration
//     • Site URL:           https://indiepact.pro
//     • Redirect URLs:      https://indiepact.pro/api/auth/callback
//                           https://indiepact.pro/auth/callback
//
//  2. Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
//     • Add:  https://indiepact.pro/api/auth/callback
//     • Keep: https://<project>.supabase.co/auth/v1/callback  (for email OTP)
//
//  3. Google Cloud Console → OAuth 2.0 Client → Authorized JavaScript origins
//     • Add:  https://indiepact.pro
//
//  4. Google Cloud Console → OAuth Consent Screen → App name
//     • Change to: "IndiePact"  (removes the *.supabase.co branding from the
//       Google sign-in screen and shows "IndiePact wants to access…" instead)
//
//  5. In AuthContext.tsx → signInWithGoogle → redirectTo option:
//     • Update to use the production callback URL:
//       `${window.location.origin}/api/auth/callback`
//       (already dynamic — no code change needed if origin is correct)
//
//  6. In artifacts/api-server → .env / Supabase config:
//     • SUPABASE_AUTH_REDIRECT_URL = https://indiepact.pro/api/auth/callback
//
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthCallback() {
  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

    // These are declared outside the Promise so the cleanup function returned
    // synchronously from useEffect can always cancel them, even if the
    // component unmounts before getSession() resolves.
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

      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        navigateTo("/");
      }, 8_000);
    });

    // Proper useEffect cleanup — always runs when component unmounts
    return () => {
      settled = true;
      authSub?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">

      {/* ── Ambient background glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(16,185,129,0.04) 0%, transparent 70%)",
        }}
      />

      {/* ── Top progress bar ── */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }}
        />
      </div>

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center text-center gap-6 px-8"
      >
        {/* Brand mark */}
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

        {/* Text */}
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold text-white tracking-tight">
            IndiePact
          </p>
          <p className="text-slate-400 text-sm font-medium">Signing you in…</p>
          <p className="text-slate-600 text-xs">You'll be redirected automatically.</p>
        </div>

        {/* Pulsing dots */}
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
      </motion.div>

    </div>
  );
}
