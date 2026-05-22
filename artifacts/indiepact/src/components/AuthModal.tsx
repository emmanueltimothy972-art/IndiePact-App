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

// ─── 6-digit OTP input ────────────────────────────────────────────────────────

function OtpInput({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.map((d, j) => (j === i ? "" : d)).join("");
      onChange(next);
      if (i > 0) refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const handleChange = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    if (!char) return;
    const next = digits.map((d, j) => (j === i ? char : d)).join("");
    onChange(next);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2.5 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          className={`h-13 w-11 rounded-xl text-center text-xl font-mono font-bold bg-slate-900 border-2 transition-all outline-none
            ${d ? "border-emerald-600/70 text-white shadow-[0_0_12px_rgba(16,185,129,0.12)]" : "border-slate-800 text-slate-600"}
            focus:border-emerald-600/60 focus:shadow-[0_0_14px_rgba(16,185,129,0.15)] disabled:opacity-40`}
        />
      ))}
    </div>
  );
}

// ─── Countdown timer hook ─────────────────────────────────────────────────────

function useCountdown(startAt: number) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(startAt);
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [startAt]);

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
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Step = "initial" | "verify" | "success";

function navigateToReturnTo() {
  const returnTo = consumeReturnTo();
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const path = returnTo && returnTo.startsWith("/") ? returnTo : "/";
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

  // Isolated loading states — Google and email flows never share state.
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(60);

  const anyLoading = isGoogleLoading || isEmailLoading;

  const reset = () => {
    setStep("initial");
    setEmail("");
    setOtp("");
    setError(null);
    setIsGoogleLoading(false);
    setIsEmailLoading(false);
    countdown.reset();
  };

  const handleClose = () => {
    if (anyLoading) return; // prevent close mid-flight
    closeAuthModal();
    setTimeout(reset, 300);
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  // isGoogleLoading stays true until the browser navigates away to Google.
  // If the OAuth call errors synchronously, we reset it and show the error.

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isEmailLoading) return;
    setError(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError("Couldn't connect to Google. Please try again.");
      setIsGoogleLoading(false);
    }
    // On success the browser redirects to Google; no reset needed.
  };

  // ── Email OTP — send / resend ─────────────────────────────────────────────

  const sendOtp = useCallback(async (targetEmail: string): Promise<boolean> => {
    setError(null);
    setIsEmailLoading(true);
    try {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${window.location.origin}${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to send code. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("Network error. Please check your connection.");
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
      setStep("verify");
      countdown.start();
    }
  };

  const handleResend = async () => {
    if (countdown.seconds > 0 || isEmailLoading) return;
    const ok = await sendOtp(email.trim().toLowerCase());
    if (ok) {
      setOtp("");
      countdown.start();
    }
  };

  // ── Email OTP — verify ────────────────────────────────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\D/g, "").length < 6 || isEmailLoading) return;
    setError(null);
    setIsEmailLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.replace(/\D/g, ""),
        type: "email",
      });
      if (error) {
        setError("Incorrect or expired code. Please check and try again.");
        setIsEmailLoading(false);
        return;
      }
      setStep("success");
      setTimeout(navigateToReturnTo, 900);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsEmailLoading(false);
    }
  };

  const otpComplete = otp.replace(/\D/g, "").length === 6;

  // ── Headlines ─────────────────────────────────────────────────────────────

  const headline =
    step === "success" ? "You're signed in!" :
    step === "verify" ? "Check your inbox" :
    authContext ? `Sign in to ${authContext}` :
    "Sign in to IndiePact";

  const subline =
    step === "success" ? "Taking you there now…" :
    step === "verify" ? `We sent a 6-digit code to ${email}` :
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

            {/* ── Initial: Google + Email inline ── */}
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
                {/* Google button — only reacts to isGoogleLoading */}
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

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-600 whitespace-nowrap">or sign in with email</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* Email + Send Code — only reacts to isEmailLoading */}
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

            {/* ── Verify: OTP + countdown ── */}
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
                <OtpInput value={otp} onChange={setOtp} disabled={isEmailLoading} />

                {error && (
                  <p className="text-red-400 text-xs text-center animate-in fade-in slide-in-from-top-1 duration-200">
                    {error}
                  </p>
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

                {/* Countdown + resend row */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <button
                    type="button"
                    onClick={() => { setError(null); setOtp(""); setStep("initial"); countdown.reset(); }}
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
