import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Lock } from "lucide-react";

export function AuthModal() {
  const { showAuthModal, closeAuthModal } = useAuth();
  const { toast } = useToast();

  const handleGoogleClick = () => {
    toast({
      title: "Coming Soon",
      description: "Google sign-in is pending domain verification. Check back shortly.",
      duration: 4000,
    });
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) closeAuthModal(); }}>
      <DialogContent
        className="p-0 border-0 max-w-sm w-full overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #0d1a12 100%)",
          border: "1px solid rgba(16,185,129,0.15)",
          boxShadow: "0 0 80px rgba(16,185,129,0.06), 0 32px 64px rgba(0,0,0,0.9)",
        }}
      >
        <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.15)]">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">IndiePact</h2>
              <p className="text-slate-400 text-sm mt-1 leading-snug max-w-[220px]">
                AI-powered contract protection for freelancers, creators, founders, and agencies.
              </p>
            </div>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleClick}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-600" />
              Secure login
            </span>
            <span className="text-slate-700">·</span>
            <span>No spam</span>
            <span className="text-slate-700">·</span>
            <span>Files stay private</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
