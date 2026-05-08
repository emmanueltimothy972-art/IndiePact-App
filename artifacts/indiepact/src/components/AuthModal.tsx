import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Mail, CheckCircle2, Loader2, X, Lock } from "lucide-react";

type Stage = "options" | "email" | "sent";

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signInWithEmail } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("options");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    closeAuthModal();
    setTimeout(() => { setStage("options"); setEmail(""); setError(null); }, 300);
  };

  const handleGoogleClick = () => {
    toast({
      title: "Google Auth Integration Pending",
      description: "Google authentication is pending domain verification. Use Professional Email for now.",
      duration: 4000,
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsSending(true);
    const { error } = await signInWithEmail(email.trim());
    setIsSending(false);
    if (error) {
      setError("Failed to send link. Check the email address and try again.");
    } else {
      setStage("sent");
    }
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="p-0 border-0 max-w-md w-full overflow-hidden"
        style={{ background: "#050505", border: "1px solid #1e293b", boxShadow: "0 0 60px rgba(16,185,129,0.08), 0 25px 50px rgba(0,0,0,0.8)" }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight">IndiePact AI</h2>
              <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Forensic Contract Intelligence</p>
            </div>
          </div>

          {stage === "options" && (
            <>
              <h3 className="text-lg font-bold text-white mb-1">Access Required</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Sign in to run forensic audits, save reports, and protect your revenue.
              </p>
            </>
          )}
          {stage === "email" && (
            <>
              <h3 className="text-lg font-bold text-white mb-1">Professional Access</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enter your work email. We'll send a secure magic link — no password required.
              </p>
            </>
          )}
          {stage === "sent" && (
            <>
              <h3 className="text-lg font-bold text-white mb-1">Check Your Inbox</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                A secure sign-in link has been dispatched to <span className="text-emerald-400 font-mono">{email}</span>.
              </p>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-3">
          {stage === "options" && (
            <>
              {/* Google — placeholder */}
              <button
                onClick={handleGoogleClick}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900 transition-all text-sm font-medium"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
                <span className="ml-auto text-[10px] font-mono text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded">SOON</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-slate-600 font-mono text-xs">or</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Email */}
              <button
                onClick={() => setStage("email")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-emerald-800/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-700 hover:bg-emerald-950/50 transition-all text-sm font-medium"
              >
                <Mail className="h-4 w-4 shrink-0" />
                Continue with Professional Email
              </button>

              <div className="flex items-center gap-2 mt-4 pt-2">
                <Lock className="h-3 w-3 text-slate-600 shrink-0" />
                <p className="text-[11px] text-slate-600 font-mono leading-relaxed">
                  Enterprise-grade encryption. Your contract data is never shared or sold.
                </p>
              </div>
            </>
          )}

          {stage === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Work Email Address</label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  className="bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 font-mono h-11 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-700"
                />
                {error && (
                  <p className="text-red-400 text-xs font-mono">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSending || !email.trim()}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] transition-all"
              >
                {isSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Dispatching Secure Link...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Send Magic Link</>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setStage("options"); setError(null); }}
                className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
              >
                ← Back to options
              </button>
            </form>
          )}

          {stage === "sent" && (
            <div className="text-center py-4 space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-slate-300 text-sm font-mono leading-relaxed">
                  Click the link in your email to complete sign-in. The link expires in 60 minutes.
                </p>
                <p className="text-slate-600 text-xs font-mono">
                  Didn't receive it? Check your spam folder, or{" "}
                  <button
                    onClick={() => { setStage("email"); setError(null); }}
                    className="text-emerald-500 hover:text-emerald-400 underline"
                  >
                    try again
                  </button>.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
              >
                Close this window
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
