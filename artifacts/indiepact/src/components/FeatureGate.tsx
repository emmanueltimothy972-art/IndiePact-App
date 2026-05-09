import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Zap, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { IS_PRO } from "@/lib/constants";

interface FeatureGateProps {
  requires: "auth" | "pro";
  children: ReactNode;
  featureName?: string;
  featureDescription?: string;
}

// In dev mode, bypass plan gates (not auth gates) so devs can preview all UI
const isDev = import.meta.env.DEV;

export function FeatureGate({ requires, children, featureName, featureDescription }: FeatureGateProps) {
  const { isGuest, openAuthModal } = useAuth();

  // Auth gate: always applies in all environments
  if (requires === "auth" && isGuest) {
    return (
      <AuthGate
        featureName={featureName}
        featureDescription={featureDescription}
        onSignIn={openAuthModal}
      />
    );
  }

  // Plan gate: bypass in dev for easy previewing
  if (requires === "pro" && !IS_PRO && !isDev) {
    return (
      <ProGate
        featureName={featureName}
        featureDescription={featureDescription}
      />
    );
  }

  return <>{children}</>;
}

function AuthGate({
  featureName,
  featureDescription,
  onSignIn,
}: {
  featureName?: string;
  featureDescription?: string;
  onSignIn: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-slate-800 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(10,10,10,0.98) 60%)",
      }}
    >
      <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(16,185,129,0.06)_0%,transparent_70%)]" />

      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          boxShadow: "0 0 24px rgba(16,185,129,0.1)",
        }}
      >
        <LogIn className="h-6 w-6 text-emerald-400" />
      </div>

      <h3 className="text-xl font-bold text-white mb-2">
        Sign in to use {featureName || "this feature"}
      </h3>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription || "Create your free IndiePact account to continue reviewing contracts, detecting risks, and negotiating smarter deals."}
      </p>

      <button
        onClick={onSignIn}
        className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center justify-center gap-5 text-xs text-slate-600 mt-5">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-emerald-800" /> Secure
        </span>
        <span>·</span>
        <span>No spam</span>
        <span>·</span>
        <span>Private by default</span>
      </div>
    </motion.div>
  );
}

function ProGate({
  featureName,
  featureDescription,
}: {
  featureName?: string;
  featureDescription?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-amber-900/30 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(212,175,55,0.04) 0%, rgba(10,10,10,0.98) 60%)",
      }}
    >
      <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(212,175,55,0.05)_0%,transparent_70%)]" />

      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: "rgba(212,175,55,0.08)",
          border: "1px solid rgba(212,175,55,0.25)",
          boxShadow: "0 0 24px rgba(212,175,55,0.08)",
        }}
      >
        <Zap className="h-6 w-6 text-amber-400" />
      </div>

      <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
        <ShieldCheck className="h-3 w-3" /> Pro Feature
      </div>

      <h3 className="text-xl font-bold text-white mb-2">
        Upgrade to unlock {featureName || "this feature"}
      </h3>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription || "This feature requires a Pro plan or higher. Upgrade to get full access to all IndiePact tools."}
      </p>

      <a
        href="/pricing"
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all shadow-[0_0_16px_rgba(212,175,55,0.25)] hover:shadow-[0_0_24px_rgba(212,175,55,0.4)] active:scale-[0.98]"
      >
        <Zap className="h-4 w-4" /> View Plans & Upgrade
      </a>

      <p className="text-xs text-slate-600 mt-4">Pro from $49.99/month · Cancel anytime</p>
    </motion.div>
  );
}
