import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Lock, Mail, ArrowRight, RotateCcw, Loader2, CheckCircle2, Smartphone } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

type Step = "welcome-back" | "entry" | "otp" | "success";

const RESEND_COOLDOWN = 30;

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: "easeOut" },
};

// ─── Digit OTP Input ───────────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const chars = value.padEnd(6, " ").split("").slice(0, 6);
    chars[index] = digit || " ";
    onChange(chars.join("").trimEnd());
    if (digit && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const chars = value.padEnd(6, " ").split("");
      if (chars[index]?.trim()) {
        chars[index] = " ";
        onChange(chars.join("").trimEnd());
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        chars[index - 1] = " ";
        onChange(chars.join("").trimEnd());
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  useEffect(() => {
    if (!value.trim()) inputsRef.current[0]?.focus();
  }, [value]);

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => {
        const digit = value[i]?.trim() ?? "";
        return (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => {
              e.target.select();
              e.target.style.border = "1.5px solid rgba(16,185,129,0.7)";
              e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.12)";
            }}
            onBlur={(e) => {
              e.target.style.border = digit
                ? "1.5px solid rgba(16,185,129,0.35)"
                : "1.5px solid rgba(255,255,255,0.1)";
              e.target.style.boxShadow = "none";
            }}
            className="w-11 text-center text-xl font-bold rounded-xl outline-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              height: "52px",
              background: digit ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
              border: digit
                ? "1.5px solid rgba(16,185,129,0.35)"
                : "1.5px solid rgba(255,255,255,0.1)",
              color: "#fff",
              caretColor: "transparent",
            }}
            aria-label={`Digit ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

// ─── Auth Modal ────────────────────────────────────────────────────────────────

export function AuthModal() {
  const {
    showAuthModal,
    closeAuthModal,
    sendOtp,
    verifyOtp,
    rememberedEmail,
    rememberThisDevice,
    forgetThisDevice,
  } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("entry");
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberChecked, setRememberChecked] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const resetModal = useCallback(() => {
    setStep(rememberedEmail ? "welcome-back" : "entry");
    setIsSignUp(true);
    setEmail("");
    setOtp("");
    setError(null);
    setIsLoading(false);
    setResendCooldown(0);
  }, [rememberedEmail]);

  const handleClose = useCallback(() => {
    closeAuthModal();
    setTimeout(resetModal, 300);
  }, [closeAuthModal, resetModal]);

  useEffect(() => {
    if (showAuthModal) {
      setStep(rememberedEmail ? "welcome-back" : "entry");
      setOtp("");
      setError(null);
    } else {
      setTimeout(resetModal, 300);
    }
  }, [showAuthModal]);

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Core actions ────────────────────────────────────────────────────────────

  const doSendOtp = async (targetEmail: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    const { error } = await sendOtp(targetEmail.trim().toLowerCase());
    setIsLoading(false);
    if (error) {
      setError("Couldn't send the code. Please check your email and try again.");
      return false;
    }
    setOtp("");
    setResendCooldown(RESEND_COOLDOWN);
    setStep("otp");
    return true;
  };

  const handleEmailSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    await doSendOtp(trimmed);
  };

  const handleWelcomeBackContinue = async () => {
    if (!rememberedEmail) return;
    setEmail(rememberedEmail);
    await doSendOtp(rememberedEmail);
  };

  const handleVerifyOtp = async (code: string) => {
    const clean = code.replace(/\s/g, "");
    if (clean.length < 6) return;
    setError(null);
    setIsLoading(true);
    const targetEmail = (email || (rememberedEmail ?? "")).trim().toLowerCase();
    const { error } = await verifyOtp(targetEmail, clean);
    setIsLoading(false);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("expired")) {
        setError("That code has expired. Request a new one below.");
      } else if (msg.includes("invalid") || msg.includes("token") || msg.includes("otp")) {
        setError("Incorrect code. Double-check and try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
      setOtp("");
      return;
    }
    if (rememberChecked) {
      rememberThisDevice(targetEmail);
    }
    setStep("success");
    setTimeout(() => {
      handleClose();
      navigate("/dashboard");
    }, 1200);
  };

  // Auto-verify when all 6 digits are entered
  useEffect(() => {
    const clean = otp.replace(/\s/g, "");
    if (clean.length === 6 && step === "otp" && !isLoading) {
      void handleVerifyOtp(otp);
    }
  }, [otp]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    const targetEmail = (email || (rememberedEmail ?? "")).trim().toLowerCase();
    setOtp("");
    setError(null);
    setIsLoading(true);
    const { error } = await sendOtp(targetEmail);
    setIsLoading(false);
    if (error) {
      setError("Couldn't resend the code. Please try again.");
      return;
    }
    setResendCooldown(RESEND_COOLDOWN);
  };

  const activeEmail = email || rememberedEmail || "";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="p-0 border-0 max-w-sm w-full overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(5,5,5,0.97) 0%, rgba(10,20,15,0.98) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow:
            "0 0 0 1px rgba(16,185,129,0.06), 0 0 80px rgba(16,185,129,0.08), 0 40px 80px rgba(0,0,0,0.95)",
        }}
      >
        <DialogTitle className="sr-only">Sign in to IndiePact</DialogTitle>
        <DialogDescription className="sr-only">
          Create your IndiePact account or sign in to continue securely.
        </DialogDescription>

        <div className="px-8 pt-9 pb-8 flex flex-col items-center text-center gap-6">

          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{
                height: 52, width: 52,
                background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                border: "1px solid rgba(16,185,129,0.25)",
                boxShadow: "0 0 28px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">IndiePact</h2>
          </div>

          {/* Steps */}
          <div className="w-full">
            <AnimatePresence mode="wait">

              {/* ── Welcome back ──────────────────────────────────── */}
              {step === "welcome-back" && (
                <motion.div key="welcome-back" {...fadeSlide} className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
                    >
                      <Smartphone className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="text-white font-semibold text-base">Welcome back</p>
                    <p className="text-slate-400 text-sm">
                      Continue as{" "}
                      <span className="text-emerald-400 font-medium">{rememberedEmail}</span>
                    </p>
                  </div>

                  <button
                    onClick={handleWelcomeBackContinue}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#000",
                      boxShadow: "0 0 24px rgba(16,185,129,0.25)",
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Send my code <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>

                  {error && <p className="text-red-400 text-xs">{error}</p>}

                  <button
                    onClick={() => {
                      forgetThisDevice();
                      setStep("entry");
                      setIsSignUp(true);
                      setError(null);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Use a different email
                  </button>
                </motion.div>
              )}

              {/* ── Entry (sign-up first) ──────────────────────────── */}
              {step === "entry" && (
                <motion.div key="entry" {...fadeSlide} className="flex flex-col gap-5">

                  {/* Headline */}
                  <div className="flex flex-col gap-1.5">
                    {isSignUp ? (
                      <>
                        <p className="text-white font-semibold text-lg leading-snug">
                          Protect your contracts with AI.
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          Create your free IndiePact account to continue securely.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-semibold text-lg leading-snug">
                          Welcome back.
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          Enter your email and we'll send you a 6-digit code.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Email form */}
                  <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        autoFocus
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        disabled={isLoading}
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all disabled:opacity-50"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: error
                            ? "1.5px solid rgba(239,68,68,0.5)"
                            : "1.5px solid rgba(255,255,255,0.1)",
                        }}
                        onFocus={(e) => {
                          e.target.style.border = "1.5px solid rgba(16,185,129,0.5)";
                          e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
                        }}
                        onBlur={(e) => {
                          e.target.style.border = error
                            ? "1.5px solid rgba(239,68,68,0.5)"
                            : "1.5px solid rgba(255,255,255,0.1)";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                    </div>

                    {/* Remember this device */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-left">
                      <div
                        onClick={() => setRememberChecked((v) => !v)}
                        className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center transition-all cursor-pointer"
                        style={{
                          background: rememberChecked ? "rgba(16,185,129,0.9)" : "rgba(255,255,255,0.06)",
                          border: rememberChecked ? "1.5px solid #10b981" : "1.5px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        {rememberChecked && (
                          <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 leading-snug">
                        Remember me on this device for 30 days
                      </span>
                    </label>

                    {error && (
                      <p className="text-red-400 text-xs text-left">{error}</p>
                    )}

                    {/* Primary CTA */}
                    <button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                      style={{
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "#000",
                        boxShadow: "0 0 24px rgba(16,185,129,0.2)",
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {isSignUp ? "Create free account" : "Send code"}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Toggle sign-up / log-in */}
                  <p className="text-xs text-slate-600">
                    {isSignUp ? (
                      <>
                        Already have an account?{" "}
                        <button
                          onClick={() => { setIsSignUp(false); setError(null); }}
                          className="text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
                        >
                          Log in
                        </button>
                      </>
                    ) : (
                      <>
                        New to IndiePact?{" "}
                        <button
                          onClick={() => { setIsSignUp(true); setError(null); }}
                          className="text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
                        >
                          Create free account
                        </button>
                      </>
                    )}
                  </p>
                </motion.div>
              )}

              {/* ── OTP entry ─────────────────────────────────────── */}
              {step === "otp" && (
                <motion.div key="otp" {...fadeSlide} className="flex flex-col gap-5">
                  <div>
                    <p className="text-white font-semibold text-base">Check your inbox</p>
                    <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                      Enter the 6-digit code sent to{" "}
                      <span className="text-emerald-400 font-medium break-all">{activeEmail}</span>
                    </p>
                  </div>

                  <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-400 text-xs"
                    >
                      {error}
                    </motion.p>
                  )}

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                      <span>Verifying…</span>
                    </div>
                  )}

                  {/* Resend row */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                    <span>Didn't receive it?</span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-500">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={isLoading}
                        className="text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Resend code
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setStep(rememberedEmail ? "welcome-back" : "entry");
                      setOtp("");
                      setError(null);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    ← Use a different email
                  </button>
                </motion.div>
              )}

              {/* ── Success ───────────────────────────────────────── */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex flex-col items-center gap-4 py-2"
                >
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(16,185,129,0.15)",
                      border: "1.5px solid rgba(16,185,129,0.4)",
                      boxShadow: "0 0 32px rgba(16,185,129,0.2)",
                    }}
                  >
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">You're in.</p>
                    <p className="text-slate-500 text-sm mt-1">Taking you to your workspace…</p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Trust indicators */}
          {step === "entry" && (
            <div className="flex items-center justify-center gap-5 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-emerald-700" />
                Secure
              </span>
              <span className="text-slate-800">·</span>
              <span>No password</span>
              <span className="text-slate-800">·</span>
              <span>No spam</span>
            </div>
          )}

          {/* Maybe later */}
          {step === "entry" && (
            <button
              onClick={handleClose}
              className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-300 transition-colors rounded-xl hover:bg-white/5 -mt-2"
            >
              Maybe later
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
