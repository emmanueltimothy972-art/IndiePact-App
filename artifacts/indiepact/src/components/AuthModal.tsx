import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, consumeReturnTo } from "@/contexts/AuthContext";
import { Lock, ArrowLeft, Mail, CheckCircle2, Timer } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

// ─── Google G icon ────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── IndiePact brand mark ─────────────────────────────────────────────────────

function BrandMark({ step }: { step: Step }) {
  if (step === "success") {
    return (
      <div className="h-12 w-12 rounded-2xl bg-emerald-900/25 border border-emerald-700/30 flex items-center justify-center">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      </div>
    );
  }
  if (step === "verify") {
    return (
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0f1f18] to-[#0a1510] border border-emerald-900/40 flex items-center justify-center">
        <Mail className="h-5 w-5 text-emerald-400" />
      </div>
    );
  }
  return (
    <div
      className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0f1f18] to-[#0a1510] border border-emerald-900/40 flex items-center justify-center"
      style={{ boxShadow: "0 0 0 1px rgba(16,185,129,0.06), 0 4px 16px rgba(0,0,0,0.5)" }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="4.5" y="2.5" width="13" height="17" rx="2" stroke="#10b981" strokeWidth="1.4" strokeOpacity="0.75" />
        <line x1="7.5" y1="7.5" x2="14.5" y2="7.5" stroke="#10b981" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.45" />
        <line x1="7.5" y1="10.5" x2="14.5" y2="10.5" stroke="#10b981" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.45" />
        <line x1="7.5" y1="13.5" x2="11.5" y2="13.5" stroke="#10b981" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.45" />
        <path d="M11.5 16.5l1.5 1.5 3-3" stroke="#10b981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── 6-box OTP input ──────────────────────────────────────────────────────────
// Hidden full-width input captures keystrokes; 6 styled digit boxes render the
// visual state. Handles typing, backspace, paste, and auto-submit at 6 digits.

function OtpBoxInput({
  value,
  onChange,
  disabled,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onComplete?: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when the verify step mounts
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const processValue = useCallback(
    (raw: string) => {
      const clean = raw.replace(/\D/g, "").slice(0, 6);
      onChange(clean);
      if (clean.length === 6) onComplete?.(clean);
    },
    [onChange, onComplete],
  );

  const digits = value.padEnd(6, "").slice(0, 6).split("");
  const filledCount = value.replace(/\D/g, "").length;

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-400 text-center font-medium">
        Enter the 6-digit code sent to your email
      </label>

      {/* Invisible capture input — sits over the boxes */}
      <div
        className="relative"
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          value={value}
          onChange={(e) => processValue(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            processValue(e.clipboardData.getData("text"));
          }}
          disabled={disabled}
          aria-label="6-digit verification code"
          className="absolute inset-0 opacity-0 w-full h-full cursor-text z-10 disabled:cursor-not-allowed"
          style={{ caretColor: "transparent" }}
        />

        {/* 6 visual digit boxes */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 6 }).map((_, i) => {
            const isFocused = filledCount === i && !disabled;
            const isFilled = i < filledCount;
            const isComplete = filledCount === 6;

            return (
              <div
                key={i}
                className={`
                  relative h-14 w-11 rounded-xl flex items-center justify-center
                  text-[22px] font-mono font-bold select-none
                  border-2 transition-all duration-150
                  ${isComplete
                    ? "border-emerald-600/70 bg-slate-900 text-white shadow-[0_0_12px_rgba(16,185,129,0.12)]"
                    : isFilled
                      ? "border-slate-600 bg-slate-900 text-white"
                      : isFocused
                        ? "border-emerald-600/60 bg-emerald-950/20 text-emerald-400"
                        : "border-slate-800 bg-slate-900/60 text-slate-700"
                  }
                `}
              >
                {digits[i] !== " " ? digits[i] : ""}
                {/* Blinking caret on the active box */}
                {isFocused && (
                  <span
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-500"
                    style={{ animation: "pulse 1s ease-in-out infinite" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-600 text-center">
        Paste directly or type each digit — code is valid for 30 minutes
      </p>
    </div>
  );
}

// ─── Countdown timer hook ─────────────────────────────────────────────────────

function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((startAt: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const s = Math.max(0, Math.floor(startAt));
    if (s === 0) return;
    setSeconds(s);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(0);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const formatted = `0:${String(seconds).padStart(2, "0")}`;
  return { seconds, formatted, start, reset };
}

// ─── Thin spinner ─────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Types & constants ────────────────────────────────────────────────────────

type Step = "initial" | "verify" | "success";

const SESSION_KEY = "ip_auth_pending";
const RESEND_COOLDOWN = 60; // seconds — UI throttle only, NOT OTP expiry

interface PendingAuth { email: string; sentAt: number }

function savePending(email: string) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, sentAt: Date.now() })); } catch {}
}
function loadPending(): PendingAuth | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingAuth;
  } catch { return null; }
}
function clearPending() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

function navigateToReturnTo() {
  const returnTo = consumeReturnTo();
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const path = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
  window.location.replace(`${window.location.origin}${base}${path}`);
}

const slideVariants = {
  enter: { opacity: 0, x: 16 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AuthModal() {
  const { showAuthModal, authContext, closeAuthModal, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<Step>("initial");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown();

  const anyLoading = isGoogleLoading || isEmailLoading;

  // ── Restore pending OTP session on modal open (survives page refresh) ──────
  useEffect(() => {
    if (!showAuthModal) return;
    const pending = loadPending();
    if (pending) {
      const elapsedSec = Math.floor((Date.now() - pending.sentAt) / 1000);
      const remaining = RESEND_COOLDOWN - elapsedSec;
      setEmail(pending.email);
      setStep("verify");
      setOtp("");
      if (remaining > 0) countdown.start(remaining);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal]);

  const reset = useCallback(() => {
    setStep("initial");
    setEmail("");
    setOtp("");
    setError(null);
    setIsGoogleLoading(false);
    setIsEmailLoading(false);
    countdown.reset();
    clearPending();
  }, [countdown]);

  const handleClose = () => {
    if (anyLoading) return;
    closeAuthModal();
    setTimeout(reset, 300);
  };

  // ── OTP verification ───────────────────────────────────────────────────────
  // Uses supabase.auth.verifyOtp directly — no server round-trip.
  // type: "magiclink" matches the OTP email template configured in Supabase.

  const submitOtp = useCallback(async (token: string) => {
    const clean = token.replace(/\D/g, "");
    if (clean.length < 6 || isEmailLoading) return;
    setError(null);
    setIsEmailLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: clean,
        type: "magiclink",
      });
      if (verifyErr) {
        setError("Incorrect or expired code — please check and try again.");
        setIsEmailLoading(false);
        return;
      }
      // Session is now established and JWT is stored in browser storage by Supabase.
      // Navigate without relying on URL query params.
      clearPending();
      setStep("success");
      setTimeout(navigateToReturnTo, 900);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsEmailLoading(false);
    }
  }, [email, isEmailLoading]);

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void submitOtp(otp);
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isEmailLoading) return;
    setError(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError("Couldn't connect to Google. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  // ── Email OTP — send ──────────────────────────────────────────────────────
  // Calls supabase.auth.signInWithOtp directly on the client.
  // No redirectTo / emailRedirectTo / magic-link options injected.
  // Supabase sends a 6-digit code when the project's OTP template is active.

  const sendOtp = useCallback(async (targetEmail: string): Promise<boolean> => {
    setError(null);
    setIsEmailLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        // Explicitly: no redirectTo, no emailRedirectTo, no shouldCreateUser override.
        // Pure server-side OTP code delivery — no magic link URL generated.
        options: {
          shouldCreateUser: true,
        },
      });
      if (otpErr) {
        setError(otpErr.message ?? "Failed to send code. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("Network error. Please check your connection and try again.");
      return false;
    } finally {
      setIsEmailLoading(false);
    }
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || isEmailLoading || isGoogleLoading) return;
    const ok = await sendOtp(trimmed);
    if (ok) {
      setOtp("");
      setError(null);
      savePending(trimmed);
      setStep("verify");
      countdown.start(RESEND_COOLDOWN);
    }
  };

  // ── Resend ────────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (countdown.seconds > 0 || isEmailLoading) return;
    const ok = await sendOtp(email.trim().toLowerCase());
    if (ok) {
      setOtp("");
      setError(null);
      savePending(email.trim().toLowerCase());
      countdown.start(RESEND_COOLDOWN);
    }
  };

  const otpComplete = otp.replace(/\D/g, "").length === 6;

  // ── Headlines ─────────────────────────────────────────────────────────────

  const headline =
    step === "success" ? "You're signed in!" :
    step === "verify"  ? "Check your inbox" :
    authContext ? `Sign in to ${authContext}` : "Sign in to IndiePact";

  const subline =
    step === "success" ? "Taking you there now…" :
    step === "verify"  ? `Code sent to ${email}` :
    "Free to start — no password, no friction.";

  return (
    <Dialog open={showAuthModal} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent
        className="p-0 border border-slate-800/80 max-w-sm w-full overflow-hidden rounded-2xl bg-[#080808]"
        style={{ boxShadow: "0 48px 96px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        <DialogTitle className="sr-only">Sign in to IndiePact</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with Google or your email to continue.
        </DialogDescription>

        <div className="px-7 pt-8 pb-7 flex flex-col gap-6">

          {/* ── Header ── */}
          <div className="flex flex-col items-center text-center gap-3">
            <BrandMark step={step} />
            <div>
              <h2 className="text-[17px] font-bold text-white tracking-tight">{headline}</h2>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">{subline}</p>
            </div>
          </div>

          {/* ── Step content ── */}
          <AnimatePresence mode="wait" initial={false}>

            {/* ── Initial: Google + Email ── */}
            {step === "initial" && (
              <motion.div
                key="initial"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isEmailLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed bg-white hover:bg-slate-100 text-slate-900 disabled:opacity-60"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }}
                >
                  {isGoogleLoading
                    ? <Spinner className="h-4 w-4 text-slate-500" />
                    : <GoogleIcon className="h-4 w-4 shrink-0" />}
                  {isGoogleLoading ? "Connecting…" : "Continue with Google"}
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-600 whitespace-nowrap">or sign in with email</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                <form onSubmit={handleSendCode} className="flex flex-col gap-2.5">
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isEmailLoading}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isEmailLoading || isGoogleLoading || !email.trim()}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-900/30"
                  >
                    {isEmailLoading
                      ? <span className="flex items-center justify-center gap-2"><Spinner className="h-4 w-4" /> Sending code…</span>
                      : "Send Code →"}
                  </button>
                </form>

                {error && (
                  <p className="text-red-400 text-xs text-center -mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {error}
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Verify: 6-box OTP input ── */}
            {step === "verify" && (
              <motion.form
                key="verify"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
                onSubmit={handleVerifyOtp}
                className="flex flex-col gap-4"
              >
                <OtpBoxInput
                  value={otp}
                  onChange={setOtp}
                  disabled={isEmailLoading}
                  onComplete={(v) => void submitOtp(v)}
                />

                {/* Error panel — appears inside the verify step, above the button */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/40 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <p className="text-red-400 text-xs leading-snug">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isEmailLoading || !otpComplete}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-900/30"
                >
                  {isEmailLoading
                    ? <span className="flex items-center justify-center gap-2"><Spinner className="h-4 w-4" /> Verifying…</span>
                    : "Verify Code"}
                </button>

                {/* Resend row */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setOtp("");
                      setStep("initial");
                      countdown.reset();
                      clearPending();
                    }}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change email
                  </button>

                  {countdown.seconds > 0 ? (
                    <span className="flex items-center gap-1.5 text-slate-600 select-none">
                      <Timer className="h-3 w-3" />
                      Resend in <span className="font-mono text-slate-500 font-semibold">{countdown.formatted}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isEmailLoading}
                      className="text-emerald-600 hover:text-emerald-400 transition-colors font-medium disabled:opacity-40"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </motion.form>
            )}

            {/* ── Success ── */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-3 py-3"
              >
                <div className="h-12 w-12 rounded-full bg-emerald-900/25 border border-emerald-800/40 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm text-slate-300 font-semibold">Welcome to IndiePact</p>
                <p className="text-xs text-slate-600">Redirecting you now…</p>
              </motion.div>
            )}

          </AnimatePresence>

          {/* ── Footer trust line ── */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-1.5 text-slate-700">
              <Lock className="h-3 w-3" />
              <span className="text-xs">No passwords stored · End-to-end encrypted</span>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
