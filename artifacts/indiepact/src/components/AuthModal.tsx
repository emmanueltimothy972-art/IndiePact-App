import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

// Google G icon SVG (official brand colors)
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

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError("Couldn't connect to Google. Please try again.");
      setIsLoading(false);
    }
    // On success Supabase redirects to Google — no need to setIsLoading(false)
    // since the page will navigate away
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) { closeAuthModal(); setError(null); setIsLoading(false); } }}>
      <DialogContent
        className="p-0 border-0 max-w-sm w-full overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(5,5,5,0.98) 0%, rgba(10,20,15,0.99) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow:
            "0 0 0 1px rgba(16,185,129,0.06), 0 0 80px rgba(16,185,129,0.08), 0 40px 80px rgba(0,0,0,0.95)",
        }}
      >
        <DialogTitle className="sr-only">Sign in to IndiePact</DialogTitle>
        <DialogDescription className="sr-only">
          Create your IndiePact account or sign in with Google to continue securely.
        </DialogDescription>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="px-8 pt-9 pb-8 flex flex-col items-center text-center gap-7"
        >
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
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">IndiePact</h2>
              <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                Protect your contracts with AI.
                <br />
                <span className="text-slate-500 text-xs">Sign in to save your reviews and unlock negotiation tools.</span>
              </p>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 bg-white hover:bg-slate-100 text-slate-900"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)" }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
              ) : (
                <GoogleIcon className="h-4 w-4 shrink-0" />
              )}
              {isLoading ? "Connecting to Google…" : "Continue with Google"}
            </button>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-xs"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Trust signals */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Lock className="h-3 w-3" />
              <span className="text-xs">Secured by Google · No passwords stored</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-snug max-w-[220px]">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
