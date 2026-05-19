import { ReactNode } from "react";
import { ShieldCheck, Lock, ArrowRight, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import {
  canAccessNegotiation,
  canAccessLegalStrategy,
  isPaidPlan,
} from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequiresTier = "auth" | "starter" | "pro" | "business";

interface FeatureGateProps {
  requires: RequiresTier;
  children: ReactNode;
  featureName?: string;
  featureDescription?: string;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

function planMeetsTier(plan: string, tier: RequiresTier): boolean {
  if (tier === "auth") return true; // just needs to be logged in
  if (tier === "starter") return isPaidPlan(plan);
  if (tier === "pro") return canAccessNegotiation(plan);
  if (tier === "business") return canAccessLegalStrategy(plan);
  return false;
}

const TIER_META: Record<RequiresTier, { label: string; price: string; cta: string }> = {
  auth:     { label: "",          price: "Free",           cta: "Create free account" },
  starter:  { label: "Starter",  price: "from $19/mo",    cta: "Upgrade to Starter" },
  pro:      { label: "Pro",       price: "from $49/mo",    cta: "Upgrade to Pro" },
  business: { label: "Business", price: "from $99/mo",    cta: "Upgrade to Business" },
};

// ─── Gate component ───────────────────────────────────────────────────────────

export function FeatureGate({ requires, children, featureName, featureDescription }: FeatureGateProps) {
  const { isGuest, openAuthModal, userPlan } = useAuth();
  const context = featureName ? `unlock ${featureName}` : undefined;

  if (requires === "auth" && isGuest) {
    return (
      <AuthGate
        featureName={featureName}
        featureDescription={featureDescription}
        onSignIn={() => openAuthModal(undefined, context)}
      />
    );
  }

  if (requires !== "auth" && (isGuest || !planMeetsTier(userPlan, requires))) {
    return (
      <UpgradeGate
        tier={requires}
        featureName={featureName}
        featureDescription={featureDescription}
        onSignIn={isGuest ? () => openAuthModal(undefined, context) : undefined}
        isGuest={isGuest}
      />
    );
  }

  return <>{children}</>;
}

// ─── Auth gate (sign-in required) ────────────────────────────────────────────

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
    <div className="flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-slate-800 bg-[#0a0a0a]">
      <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center mb-5">
        <ShieldCheck className="h-5 w-5 text-slate-300" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {featureName ? `Sign in to use ${featureName}` : "Create your free account to continue"}
      </h3>
      <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription ||
          "IndiePact is free to start. Create your account to review contracts, detect risks, and negotiate smarter."}
      </p>

      <button
        onClick={onSignIn}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors bg-emerald-700 hover:bg-emerald-600 text-white"
      >
        Create free account
        <ArrowRight className="h-4 w-4" />
      </button>

      <p className="text-xs text-slate-600 mt-4">
        Already have an account?{" "}
        <button onClick={onSignIn} className="text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2">
          Log in
        </button>
      </p>

      <div className="flex items-center justify-center gap-4 text-xs text-slate-700 mt-5">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> Secure
        </span>
        <span>·</span>
        <span>No password</span>
        <span>·</span>
        <span>No spam</span>
      </div>
    </div>
  );
}

// ─── Upgrade gate (plan upgrade required) ────────────────────────────────────

function UpgradeGate({
  tier,
  featureName,
  featureDescription,
  onSignIn,
  isGuest,
}: {
  tier: RequiresTier;
  featureName?: string;
  featureDescription?: string;
  onSignIn?: () => void;
  isGuest: boolean;
}) {
  const meta = TIER_META[tier];

  const defaultDescriptions: Record<RequiresTier, string> = {
    auth: "",
    starter: "Available on the Starter plan and above — includes PDF uploads, AI Attorney, clause rewrites, and export.",
    pro:     "Available on the Pro plan and above — includes the Negotiation War Room, Payment Lock, and advanced negotiation tools.",
    business: "Available on the Business plan and above — includes AI Legal Strategy, full platform access, and priority processing.",
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-slate-800 bg-[#0a0a0a]">
      <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center mb-5">
        <Lock className="h-5 w-5 text-slate-400" />
      </div>

      <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
        {meta.label} Plan Required
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        Upgrade to unlock {featureName || "this feature"}
      </h3>
      <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-7">
        {featureDescription || defaultDescriptions[tier]}
      </p>

      <Link
        href="/pricing"
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-colors"
      >
        {meta.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>

      <Link
        href="/pricing"
        className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors mt-3"
      >
        Compare all plans <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      <p className="text-xs text-slate-700 mt-4">{meta.price} · Cancel anytime</p>

      {isGuest && onSignIn && (
        <p className="text-xs text-slate-600 mt-3">
          No account yet?{" "}
          <button onClick={onSignIn} className="text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2">
            Create a free account first
          </button>
        </p>
      )}
    </div>
  );
}
