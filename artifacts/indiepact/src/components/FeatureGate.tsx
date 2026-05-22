import { ReactNode } from "react";
import {
  ShieldCheck, Lock, ArrowRight, ChevronRight,
  Zap, BarChart3, FileDown, Brain, Scale, Target,
  Shield, FileText, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { hasFeature } from "@/lib/permissions";

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
  if (tier === "auth") return true;
  if (tier === "starter") return hasFeature(plan, "UPLOADS");
  if (tier === "pro") return hasFeature(plan, "NEGOTIATION");
  if (tier === "business") return hasFeature(plan, "LEGAL_STRATEGY");
  return false;
}

const TIER_META: Record<
  RequiresTier,
  {
    label: string;
    price: string;
    cta: string;
    headline: string;
    sub: string;
    benefits: { icon: ReactNode; text: string }[];
  }
> = {
  auth: {
    label: "",
    price: "Free",
    cta: "Create free account",
    headline: "Create your free account to continue",
    sub: "IndiePact is free to start.",
    benefits: [],
  },
  starter: {
    label: "Starter",
    price: "$19/mo",
    cta: "Upgrade to Starter — $19/mo",
    headline: "Unlock Full Contract Protection",
    sub: "Get PDF uploads, scan history, and exportable audit reports — everything you need to stay covered.",
    benefits: [
      { icon: <FileText className="h-4 w-4 text-emerald-400" />, text: "PDF & DOCX contract uploads" },
      { icon: <Zap className="h-4 w-4 text-emerald-400" />, text: "10 AI deep-scans per month" },
      { icon: <FileDown className="h-4 w-4 text-emerald-400" />, text: "Exportable forensic audit reports" },
    ],
  },
  pro: {
    label: "Pro",
    price: "$49/mo",
    cta: "Upgrade to Pro — $49/mo",
    headline: "Unlock Pro Insights to Scale Your Business",
    sub: "See every dangerous clause, rewrite them in your favor, and walk into every negotiation armed.",
    benefits: [
      { icon: <Zap className="h-4 w-4 text-emerald-400" />, text: "50 AI deep-scans per month" },
      { icon: <BarChart3 className="h-4 w-4 text-emerald-400" />, text: "Clause-by-clause risk analysis & rewrites" },
      { icon: <FileDown className="h-4 w-4 text-emerald-400" />, text: "Exportable forensic business reports" },
    ],
  },
  business: {
    label: "Business",
    price: "$99/mo",
    cta: "Upgrade to Business — $99/mo",
    headline: "Unlock Business-Level Legal Intelligence",
    sub: "Full AI Legal Strategy with power balance scoring, priority risk ranking, and complete negotiation playbooks.",
    benefits: [
      { icon: <Brain className="h-4 w-4 text-emerald-400" />, text: "Full AI Legal Strategy analysis" },
      { icon: <Scale className="h-4 w-4 text-emerald-400" />, text: "Power balance & negotiation plans" },
      { icon: <Target className="h-4 w-4 text-emerald-400" />, text: "Priority risk ranking & red flag detection" },
    ],
  },
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
        <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Secure</span>
        <span>·</span>
        <span>No password</span>
        <span>·</span>
        <span>No spam</span>
      </div>
    </div>
  );
}

// ─── Upgrade gate (premium preview paywall) ───────────────────────────────────

function UpgradeGate({
  tier,
  featureName,
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

  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[580px]">

      {/* ── Blurred background mockup ─────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="opacity-25 blur-[3px] scale-[1.02] origin-top">
          {tier === "business" ? <BusinessMockup /> : <ProMockup />}
        </div>
      </div>

      {/* ── Dark gradient overlay ──────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/75 via-[#050505]/65 to-[#050505]/90 pointer-events-none" />

      {/* ── Paywall card ───────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-center min-h-[580px] px-4 py-12">
        <div className="w-full max-w-md bg-[#0d0d0d]/90 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-8 shadow-2xl shadow-black/60 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full mb-5 uppercase tracking-wider">
            <Lock className="h-2.5 w-2.5" />
            {meta.label} Plan Required
          </div>

          {/* Icon */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/30 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>

          {/* Headline */}
          <h3 className="text-xl font-bold text-white mb-3 leading-snug">
            {meta.headline}
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-7 max-w-xs mx-auto">
            {meta.sub}
          </p>

          {/* Benefits */}
          {meta.benefits.length > 0 && (
            <ul className="space-y-3 mb-8 text-left">
              {meta.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/60 rounded-xl px-4 py-3">
                  <span className="shrink-0">{b.icon}</span>
                  <span className="text-slate-200 text-sm font-medium">{b.text}</span>
                </li>
              ))}
            </ul>
          )}

          {/* CTA button */}
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-lg shadow-emerald-900/30 mb-3"
          >
            {meta.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>

          {/* Secondary link */}
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Compare all plans <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <p className="text-xs text-slate-700 mt-4">No contracts · Cancel anytime</p>

          {featureName && (
            <p className="text-xs text-slate-600 mt-1">Required for: <span className="text-slate-500">{featureName}</span></p>
          )}

          {isGuest && onSignIn && (
            <p className="text-xs text-slate-600 mt-3">
              No account yet?{" "}
              <button onClick={onSignIn} className="text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2">
                Create a free account first
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pro background mockup ────────────────────────────────────────────────────

function ProMockup() {
  const mockClauses = [
    { category: "IP Ownership", severity: "High", score: 24, text: "All deliverables become property of Client immediately upon creation, regardless of payment status." },
    { category: "Scope Creep", severity: "High", score: 18, text: "Client may request unlimited revisions at no additional cost until fully satisfied." },
    { category: "Payment Delay", severity: "Medium", score: 52, text: "Payment shall be made within 60 days of invoice receipt (Net-60)." },
    { category: "Termination", severity: "Medium", score: 48, text: "Either party may terminate with 7 days' written notice, with no further obligation." },
    { category: "Liability Cap", severity: "Low", score: 81, text: "Contractor liability shall not exceed $500 in aggregate for any claims." },
  ];

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Scale className="h-4 w-4 text-slate-300" />
          </div>
          <div>
            <div className="h-4 w-32 bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-800 rounded mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          {["All", "High", "Medium", "Low"].map((f) => (
            <div key={f} className={`h-7 px-3 rounded-lg text-xs flex items-center border ${f === "All" ? "bg-slate-700 border-slate-600 text-white" : "bg-transparent border-slate-800 text-slate-600"}`}>{f}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Clause list */}
        <div className="col-span-1 space-y-2">
          {mockClauses.map((c, i) => {
            const sev = c.severity === "High"
              ? { badge: "bg-red-950/40 border-red-800/40 text-red-400", dot: "bg-red-500" }
              : c.severity === "Medium"
              ? { badge: "bg-amber-950/40 border-amber-800/40 text-amber-400", dot: "bg-amber-500" }
              : { badge: "bg-slate-800 border-slate-700 text-slate-400", dot: "bg-slate-500" };
            return (
              <div key={i} className={`rounded-xl border p-3 cursor-pointer ${i === 0 ? "border-emerald-800/50 bg-emerald-950/10" : "border-slate-800 bg-[#0a0a0a]"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.badge}`}>{c.severity}</span>
                  <span className={`text-xs font-mono ${c.score < 40 ? "text-red-400" : c.score < 65 ? "text-amber-400" : "text-emerald-400"}`}>{c.score}</span>
                </div>
                <p className="text-xs text-slate-400 font-medium">{c.category}</p>
                <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${sev.dot}`} style={{ width: `${c.score}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="col-span-2 space-y-4">
          <div className="rounded-2xl border border-red-900/30 bg-[#0a0a0a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">High Risk — IP Ownership</span>
            </div>
            <div className="h-3 w-full bg-slate-800 rounded mb-2" />
            <div className="h-3 w-4/5 bg-slate-800 rounded mb-2" />
            <div className="h-3 w-3/5 bg-slate-800 rounded mb-4" />
            <div className="p-3 rounded-xl bg-red-950/15 border border-red-900/20">
              <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Why this hurts you</p>
              <div className="h-2.5 w-full bg-red-900/20 rounded mb-1.5" />
              <div className="h-2.5 w-3/4 bg-red-900/20 rounded" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-900/30 bg-[#071510] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Counter-Clause</span>
              </div>
              <div className="h-2.5 w-full bg-emerald-900/20 rounded mb-1.5" />
              <div className="h-2.5 w-full bg-emerald-900/20 rounded mb-1.5" />
              <div className="h-2.5 w-2/3 bg-emerald-900/20 rounded" />
            </div>
            <div className="rounded-2xl border border-blue-900/30 bg-[#07101a] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Rebuttal Script</span>
              </div>
              <div className="h-2.5 w-full bg-blue-900/20 rounded mb-1.5" />
              <div className="h-2.5 w-full bg-blue-900/20 rounded mb-1.5" />
              <div className="h-2.5 w-3/4 bg-blue-900/20 rounded" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Protection Score</span>
              <span className="text-lg font-bold font-mono text-red-400">34<span className="text-xs text-slate-600">/100</span></span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: "34%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Business background mockup ───────────────────────────────────────────────

function BusinessMockup() {
  const steps = [
    { n: 1, action: "Anchor on payment terms", tactic: "Anchor", text: "Open by proposing Net-14 payment terms as your standard, making Net-30 feel like a compromise." },
    { n: 2, action: "Challenge the IP clause", tactic: "Reframe", text: "Frame IP transfer as contingent on payment — position it as industry standard, not a demand." },
    { n: 3, action: "Cap the revision scope", tactic: "Trade", text: "Offer 3 revision rounds explicitly in exchange for removing the unlimited revisions clause." },
  ];

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-5">
      {/* Assessment */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Strategic Assessment</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-800 rounded" />
          <div className="h-3 w-5/6 bg-slate-800 rounded" />
          <div className="h-3 w-4/5 bg-slate-800 rounded" />
        </div>
      </div>

      {/* Power meter */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Your Negotiating Position</span>
          </div>
          <span className="text-lg font-bold font-mono text-amber-400">Moderate</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
          <span>Unfavorable</span><span>Balanced</span><span>Strong</span>
        </div>
        <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="absolute h-full rounded-full bg-amber-500 transition-all" style={{ width: "52%" }} />
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
        </div>
        <div className="flex justify-between text-[10px] mt-1.5">
          <span className="text-slate-700">0</span>
          <span className="font-bold font-mono text-amber-400">52/100</span>
          <span className="text-slate-700">100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Priority risks */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Target className="h-3.5 w-3.5 text-red-400" /> Priority Issues
          </h4>
          {[
            { rank: 1, title: "Unlimited Revisions Clause", urgency: "Immediate" },
            { rank: 2, title: "IP Transfer on Creation", urgency: "High" },
            { rank: 3, title: "Net-60 Payment Terms", urgency: "Moderate" },
          ].map((r) => (
            <div key={r.rank} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3 flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">{r.rank}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{r.title}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-1 inline-block ${r.urgency === "Immediate" ? "bg-red-950/20 border-red-900/30 text-red-300/80" : r.urgency === "High" ? "bg-amber-950/20 border-amber-900/30 text-amber-300/80" : "bg-slate-800/50 border-slate-700/50 text-slate-400"}`}>{r.urgency}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Negotiation steps */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Shield className="h-3.5 w-3.5 text-emerald-400" /> Negotiation Order
          </h4>
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-emerald-900/40 border border-emerald-800/50 flex items-center justify-center text-[10px] font-bold text-emerald-400">{s.n}</div>
                  <span className="text-xs font-semibold text-white">{s.action}</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-800/60 border-slate-700/60 text-slate-400">{s.tactic}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Checklist footer */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Pre-Signing Checklist</span>
          <span className="text-[10px] text-slate-500 font-mono">0/7 complete</span>
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-slate-700 bg-slate-800 shrink-0" />
              <div className={`h-2.5 bg-slate-800 rounded`} style={{ width: `${65 + i * 8}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
