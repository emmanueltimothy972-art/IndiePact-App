import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Zap, ArrowRight, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

interface FeatureGateProps {
  requires: "auth" | "pro";
  children: ReactNode;
  featureName?: string;
  featureDescription?: string;
}

export function FeatureGate({ requires, children, featureName, featureDescription }: FeatureGateProps) {
  const { isGuest, openAuthModal, userPlan } = useAuth();

  if (requires === "auth" && isGuest) {
    return (
      <AuthGate
        featureName={featureName}
        featureDescription={featureDescription}
        onSignIn={openAuthModal}
      />
    );
  }

  if (requires === "pro" && (isGuest || userPlan === "free")) {
    return (
      <ProGate
        featureName={featureName}
        featureDescription={featureDescription}
        onSignIn={openAuthModal}
        isGuest={isGuest}
      />
    );
  }

  return <>{children}</>;
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

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
        <ShieldCheck className="h-6 w-6 text-emerald-400" />
      </div>

      <h3 className="text-xl font-bold text-white mb-2">
        {featureName ? `Sign in to use ${featureName}` : "Create your free account to continue"}
      </h3>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription ||
          "IndiePact is free to start. Create your account to review contracts, detect risks, and negotiate smarter deals."}
      </p>

      <button
        onClick={onSignIn}
        className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_32px_rgba(16,185,129,0.4)]"
        style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#000" }}
      >
        Create free account
        <ArrowRight className="h-4 w-4" />
      </button>

      <p className="text-xs text-slate-600 mt-4">
        Already have an account?{" "}
        <button
          onClick={onSignIn}
          className="text-emerald-600 hover:text-emerald-400 transition-colors"
        >
          Log in
        </button>
      </p>

      <div className="flex items-center justify-center gap-5 text-xs text-slate-700 mt-5">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-emerald-900" /> Secure
        </span>
        <span>·</span>
        <span>No password</span>
        <span>·</span>
        <span>No spam</span>
      </div>
    </motion.div>
  );
}

// ─── Pro gate ─────────────────────────────────────────────────────────────────

function ProGate({
  featureName,
  featureDescription,
  onSignIn,
  isGuest,
}: {
  featureName?: string;
  featureDescription?: string;
  onSignIn: () => void;
  isGuest: boolean;
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
        <ShieldCheck className="h-3 w-3" /> Paid Feature
      </div>

      <h3 className="text-xl font-bold text-white mb-2">
        Upgrade to unlock {featureName || "this feature"}
      </h3>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription ||
          "This feature is available on paid plans. Upgrade to get full access to all IndiePact tools, unlimited reviews, and advanced AI."}
      </p>

      {/* Primary: upgrade */}
      <Link
        href="/pricing"
        className="flex items-center gap-2 px-7 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all shadow-[0_0_16px_rgba(212,175,55,0.25)] hover:shadow-[0_0_28px_rgba(212,175,55,0.4)] active:scale-[0.98]"
      >
        <Zap className="h-4 w-4" /> Unlock Now
      </Link>

      {/* Secondary: compare plans */}
      <Link
        href="/pricing"
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-3"
      >
        Compare all plans <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      <p className="text-xs text-slate-700 mt-4">Plans from $19/month · Cancel anytime</p>

      {/* If guest, offer to sign up first */}
      {isGuest && (
        <p className="text-xs text-slate-600 mt-3">
          No account yet?{" "}
          <button
            onClick={onSignIn}
            className="text-emerald-600 hover:text-emerald-400 transition-colors"
          >
            Create a free account first
          </button>
        </p>
      )}
    </motion.div>
  );
}
