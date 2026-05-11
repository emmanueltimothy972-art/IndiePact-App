import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Lock, Mail, ArrowRight, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

type Step = "mode" | "email" | "otp" | "success";
type Mode = "login" | "signup";

const RESEND_COOLDOWN = 30;

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: "easeOut" },
};

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
    const next = value.split("");
    next[index] = digit;
    const joined = next.join("").slice(0, 6);
    onChange(joined.padEnd(6, " ").trimEnd());
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[index]) {
        const next = value.split("");
        next[index] = "";
        onChange(next.join(""));
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        const next = value.split("");
        next[index - 1] = "";
        onChange(next.join(""));
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
    if (value === "") {
      inputsRef.current[0]?.focus();
    }
  }, [value]);

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => {
        const digit = value[i] ?? "";
        const isActive = inputsRef.current[i] === document.activeElement;
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
            onFocus={(e) => e.target.select()}
            className="w-11 h-13 text-center text-xl font-bold rounded-xl border outline-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: digit
                ? "rgba(16,185,129,0.08)"
                : "rgba(255,255,255,0.04)",
              border: isActive
                ? "1.5px solid rgba(16,185,129,0.7)"
                : digit
                ? "1.5px solid rgba(16,185,129,0.35)"
                : "1.5px solid rgba(255,255,255,0.1)",
              color: "#fff",
              caretColor: "transparent",
              boxShadow: isActive
                ? "0 0 0 3px rgba(16,185,129,0.12)"
                : undefined,
              height: "52px",
            }}
            aria-label={`Digit ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

export function AuthModal() {
  const { showAuthModal, closeAuthModal, sendOtp, verifyOtp } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const resetModal = useCallback(() => {
    setStep("mode");
    setMode("login");
    setEmail("");
    setOtp("");
    setError(null);
    setIsLoading(false);
    setResendCooldown(0);
  }, []);

  const handleClose = useCallback(() => {
    closeAuthModal();
    setTimeout(resetModal, 300);
  }, [closeAuthModal, resetModal]);

  useEffect(() => {
    if (!showAuthModal) {
      setTimeout(resetModal, 300);
    }
  }, [showAuthModal, resetModal]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setIsLoading(true);
    const { error } = await sendOtp(trimmed);
    setIsLoading(false);
    if (error) {
      setError("Couldn't send the code. Please try again.");
      return;
    }
    setOtp("");
    setResendCooldown(RESEND_COOLDOWN);
    setStep("otp");
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.replace(/\s/g, "").length < 6) return;
    setError(null);
    setIsLoading(true);
    const { error } = await verifyOtp(email.trim().toLowerCase(), code.trim());
    setIsLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("expired")) {
        setError("That code has expired. Request a new one below.");
      } else if (msg.includes("invalid") || msg.includes("token")) {
        setError("Incorrect code. Double-check and try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
      setOtp("");
      return;
    }
    setStep("success");
    setTimeout(() => {
      handleClose();
      navigate("/dashboard");
    }, 1200);
  };

  useEffect(() => {
    const clean = otp.replace(/\s/g, "");
    if (clean.length === 6 && step === "otp" && !isLoading) {
      void handleVerifyOtp(otp);
    }
  }, [otp]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setError(null);
    setOtp("");
    setIsLoading(true);
    const { error } = await sendOtp(email.trim().toLowerCase());
    setIsLoading(false);
    if (error) {
      setError("Couldn't resend the code. Please try again.");
      return;
    }
    setResendCooldown(RESEND_COOLDOWN);
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="p-0 border-0 max-w-sm w-full overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(5,5,5,0.97) 0%, rgba(10,20,15,0.98) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow: "0 0 0 1px rgba(16,185,129,0.06), 0 0 80px rgba(16,185,129,0.08), 0 40px 80px rgba(0,0,0,0.95)",
        }}
      >
        <DialogTitle className="sr-only">Sign in to IndiePact</DialogTitle>
        <DialogDescription className="sr-only">
          Enter your email to continue securely into IndiePact.
        </DialogDescription>

        <div className="px-8 pt-9 pb-8 flex flex-col items-center text-center gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-13 w-13 rounded-2xl flex items-center justify-center"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                border: "1px solid rgba(16,185,129,0.25)",
                boxShadow: "0 0 28px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
                height: 52,
                width: 52,
              }}
            >
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">IndiePact</h2>
            </div>
          </div>

          {/* Step content */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {/* STEP: mode selection */}
              {step === "mode" && (
                <motion.div key="mode" {...fadeSlide} className="flex flex-col gap-4">
                  <p className="text-slate-400 text-sm leading-relaxed max-w-[240px] mx-auto">
                    Enter your email to continue securely into IndiePact.
                  </p>
                  <div className="flex rounded-xl overflow-hidden border border-white/10 w-full">
                    <button
                      onClick={() => { setMode("login"); setError(null); }}
                      className="flex-1 py-2.5 text-sm font-semibold transition-all"
                      style={{
                        background: mode === "login" ? "rgba(16,185,129,0.15)" : "transparent",
                        color: mode === "login" ? "#34d399" : "rgba(255,255,255,0.4)",
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      Log In
                    </button>
                    <button
                      onClick={() => { setMode("signup"); setError(null); }}
                      className="flex-1 py-2.5 text-sm font-semibold transition-all"
                      style={{
                        background: mode === "signup" ? "rgba(16,185,129,0.15)" : "transparent",
                        color: mode === "signup" ? "#34d399" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      Sign Up
                    </button>
                  </div>
                  <button
                    onClick={() => setStep("email")}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#000",
                      boxShadow: "0 0 24px rgba(16,185,129,0.25)",
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Continue with Email
                  </button>
                </motion.div>
              )}

              {/* STEP: email input */}
              {step === "email" && (
                <motion.div key="email" {...fadeSlide} className="flex flex-col gap-4">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {mode === "signup"
                      ? "Enter your email — we'll send you a secure 6-digit code."
                      : "Enter your email and we'll send a secure 6-digit code."}
                  </p>
                  <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
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
                          border: error ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
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
                    {error && (
                      <p className="text-red-400 text-xs text-left">{error}</p>
                    )}
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
                          Send Code
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                  <button
                    onClick={() => { setStep("mode"); setError(null); }}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-1"
                  >
                    ← Back
                  </button>
                </motion.div>
              )}

              {/* STEP: OTP input */}
              {step === "otp" && (
                <motion.div key="otp" {...fadeSlide} className="flex flex-col gap-5">
                  <div>
                    <p className="text-white font-semibold text-base">Check your email</p>
                    <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                      Enter the 6-digit code sent to{" "}
                      <span className="text-emerald-400 font-medium">{email}</span>
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
                      <span>Verifying...</span>
                    </div>
                  )}

                  {/* Resend row */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                    <span>Didn't receive it?</span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-500">
                        Resend in {resendCooldown}s
                      </span>
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
                    onClick={() => { setStep("email"); setOtp(""); setError(null); }}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    ← Use a different email
                  </button>
                </motion.div>
              )}

              {/* STEP: success */}
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

          {/* Trust indicators — shown on mode and email steps */}
          {(step === "mode" || step === "email") && (
            <div className="flex items-center justify-center gap-5 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-emerald-700" />
                Secure
              </span>
              <span className="text-slate-800">·</span>
              <span>No spam</span>
              <span className="text-slate-800">·</span>
              <span>Private by default</span>
            </div>
          )}

          {/* Maybe later — shown on mode step */}
          {step === "mode" && (
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
