import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, consumeReturnTo } from "@/contexts/AuthContext";
import { ShieldCheck, Loader2, Lock, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { useState, useRef } from "react";
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

// ─── OTP digit input ──────────────────────────────────────────────────────────

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
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
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
          className={`h-12 w-10 rounded-lg text-center text-lg font-mono font-bold bg-slate-900 border transition-colors outline-none
            ${d ? "border-slate-500 text-white" : "border-slate-800 text-slate-600"}
            focus:border-slate-500 focus:ring-0 disabled:opacity-40`}
        />
      ))}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Step = "options" | "email" | "verify" | "success";

function navigateToReturnTo() {
  const returnTo = consumeReturnTo();
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const path = returnTo && returnTo.startsWith("/") ? returnTo : "/";
  window.location.replace(`${window.location.origin}${base}${path}`);
}

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<Step>("options");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("options");
    setEmail("");
    setOtp("");
    setError(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    closeAuthModal();
    // Delay reset so the close animation plays first
    setTimeout(reset, 300);
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError("Couldn't connect to Google. Please try again.");
      setIsLoading(false);
    }
    // On success the browser navigates away to Google — no cleanup needed
  };

  // ── Email OTP — send ──────────────────────────────────────────────────────

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsLoading(true);
    try {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${window.location.origin}${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to send code. Please try again.");
        setIsLoading(false);
        return;
      }
      setStep("verify");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email OTP — verify ────────────────────────────────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\D/g, "").length < 6) return;
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.replace(/\D/g, ""),
        type: "email",
      });
      if (error) {
        setError("Incorrect or expired code. Please check and try again.");
        setIsLoading(false);
        return;
      }
      // Session established — AuthContext will close the modal via onAuthStateChange,
      // but we navigate here so the user lands where they intended.
      setStep("success");
      setTimeout(navigateToReturnTo, 800);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const otpComplete = otp.replace(/\D/g, "").length === 6;

  return (
    <Dialog
      open={showAuthModal}
      onOpenChange={(open) => { if (!open) handleClose(); }}
    >
      <DialogContent
        className="p-0 border border-slate-800 max-w-sm w-full overflow-hidden rounded-2xl bg-[#080808]"
        style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        <DialogTitle className="sr-only">Sign in to IndiePact</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with Google or your email to continue.
        </DialogDescription>

        <div className="px-7 pt-8 pb-7 flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Sign in to IndiePact</h2>
              <p className="text-slate-500 text-sm mt-1">
                {step === "verify"
                  ? `We sent a 6-digit code to ${email}`
                  : step === "success"
                  ? "Signed in successfully"
                  : "Review contracts and protect your work."}
              </p>
            </div>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait" initial={false}>

            {/* ── Options ── */}
            {step === "options" && (
              <motion.div
                key="options"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-3"
              >
                {/* Google */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-white hover:bg-slate-100 text-slate-900 border border-transparent"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  ) : (
                    <GoogleIcon className="h-4 w-4 shrink-0" />
                  )}
                  {isLoading ? "Connecting…" : "Continue with Google"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-600">or</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* Email option */}
                <button
                  onClick={() => { setError(null); setStep("email"); }}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-all active:scale-[0.98] bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800"
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  Continue with Email
                </button>

                {error && (
                  <p className="text-red-400 text-xs text-center">{error}</p>
                )}
              </motion.div>
            )}

            {/* ── Email entry ── */}
            {step === "email" && (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleSendOtp}
                className="flex flex-col gap-3"
              >
                <input
                  type="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors disabled:opacity-50"
                />
                {error && (
                  <p className="text-red-400 text-xs">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-slate-700 hover:bg-slate-600 text-white"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
                    </span>
                  ) : "Send verification code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setError(null); setStep("options"); }}
                  className="flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              </motion.form>
            )}

            {/* ── OTP verify ── */}
            {step === "verify" && (
              <motion.form
                key="verify"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleVerifyOtp}
                className="flex flex-col gap-4"
              >
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-red-400 text-xs text-center">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !otpComplete}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-slate-700 hover:bg-slate-600 text-white"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                    </span>
                  ) : "Verify code"}
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setError(null); setOtp(""); setStep("email"); }}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtp(""); handleSendOtp({ preventDefault: () => {} } as React.FormEvent); }}
                    disabled={isLoading}
                    className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
                  >
                    Resend code
                  </button>
                </div>
              </motion.form>
            )}

            {/* ── Success ── */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-3 py-2"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-900/40 border border-emerald-800/40 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm text-slate-300 font-medium">You're signed in</p>
                <p className="text-xs text-slate-600">Redirecting you back…</p>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Footer trust line */}
          {(step === "options" || step === "email") && (
            <div className="flex items-center justify-center gap-1.5 text-slate-700">
              <Lock className="h-3 w-3" />
              <span className="text-xs">No passwords stored · Secured by Supabase</span>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
