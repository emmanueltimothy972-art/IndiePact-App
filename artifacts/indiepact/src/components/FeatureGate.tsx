import { ReactNode } from "react";
import {
  Lock, ArrowRight, ChevronRight,
  Brain, Scale, DollarSign, Swords,
  AlertTriangle, CheckCircle2, Target,
  Clock, Shield, FileText,
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

// ─── Tier CTA config ──────────────────────────────────────────────────────────

const TIER_CTA: Record<RequiresTier, { label: string; price: string; cta: string }> = {
  auth:     { label: "Free",     price: "Free",    cta: "Create free account"    },
  starter:  { label: "Starter",  price: "$19/mo",  cta: "Upgrade to Starter"     },
  pro:      { label: "Pro",      price: "$49/mo",  cta: "Upgrade to Pro"         },
  business: { label: "Business", price: "$99/mo",  cta: "Upgrade to Business"    },
};

// ─── Feature-specific gate config ─────────────────────────────────────────────

type ExampleSeverity = "high" | "medium" | "neutral";

interface FeatureGateConfig {
  icon: ReactNode;
  headline: string;
  sub: string;
  exampleOutputs: { text: string; severity: ExampleSeverity }[];
  benefits: string[];
  mockupType: "ai_attorney" | "negotiation" | "payment_lock" | "legal_strategy";
}

const FEATURE_GATES: Record<string, FeatureGateConfig> = {
  "Contract Intelligence": {
    icon: <Brain className="h-4.5 w-4.5 text-slate-400" />,
    headline: "Your Second Chair During Contract Review",
    sub: "Identify hidden contract risks, flag dangerous language, and receive professional-grade rewrite recommendations before signing.",
    exampleOutputs: [
      { text: "5 high-severity clauses identified", severity: "high" },
      { text: "IP ownership transfers without payment protection", severity: "high" },
      { text: "Protective rewrite available for every flagged clause", severity: "neutral" },
    ],
    benefits: [
      "Detect hidden negotiation weaknesses before you sign",
      "Rewrite risky language in your favor with AI-generated clauses",
      "Understand exactly why each clause damages your position",
    ],
    mockupType: "ai_attorney",
  },

  "Negotiation War Room": {
    icon: <Swords className="h-4.5 w-4.5 text-slate-400" />,
    headline: "Win Negotiations Before The First Reply",
    sub: "Generate leverage-focused responses, counter risky clauses, and prepare negotiation strategies with AI-assisted contract intelligence.",
    exampleOutputs: [
      { text: "7 negotiation vulnerabilities detected", severity: "high" },
      { text: "2 dangerous clauses ready for counter-offer", severity: "medium" },
      { text: "Rebuttal email generated and ready to send", severity: "neutral" },
    ],
    benefits: [
      "Identify leverage points the other party is counting on",
      "Reduce payment disputes with enforceable counter-clauses",
      "Enter negotiations with a strategic playbook, not just intuition",
    ],
    mockupType: "negotiation",
  },

  "Payment Lock": {
    icon: <DollarSign className="h-4.5 w-4.5 text-slate-400" />,
    headline: "Prevent Payment Problems Before They Start",
    sub: "Protect milestones, reduce scope creep, and strengthen payment enforcement before work begins.",
    exampleOutputs: [
      { text: "3 payment risk indicators flagged", severity: "high" },
      { text: "Late-payment protection language missing", severity: "medium" },
      { text: "Stop-work triggers recommended on 2 terms", severity: "neutral" },
    ],
    benefits: [
      "Enforce milestone payments before delivering any work",
      "Reduce scope creep with enforceable revision limits",
      "Protect yourself with legally sound stop-work language",
    ],
    mockupType: "payment_lock",
  },

  "Clause Armory": {
    icon: <Shield className="h-4.5 w-4.5 text-slate-400" />,
    headline: "Professional Clauses Used By Agencies & Consultants",
    sub: "Access a premium library of battle-tested clauses designed to reduce liability and strengthen contracts.",
    exampleOutputs: [
      { text: "47 professional clause templates available", severity: "neutral" },
      { text: "IP protection, payment, and termination covered", severity: "neutral" },
      { text: "Recommended clauses matched to your contract type", severity: "neutral" },
    ],
    benefits: [
      "Stop writing protective language from scratch every engagement",
      "Reduce liability with clauses proven across real contracts",
      "Adapt professional templates to any deal in minutes",
    ],
    mockupType: "ai_attorney",
  },

  "Contract Strategy": {
    icon: <Scale className="h-4.5 w-4.5 text-slate-400" />,
    headline: "Contract Intelligence For Business Decisions",
    sub: "Move beyond contract review and understand negotiation patterns, operational risk exposure, and strategic positioning on every deal.",
    exampleOutputs: [
      { text: "Power balance score: 38/100 — unfavorable position", severity: "high" },
      { text: "6 priority issues ranked by negotiation urgency", severity: "medium" },
      { text: "3-phase strategic playbook generated", severity: "neutral" },
    ],
    benefits: [
      "Understand your actual negotiating position before the table",
      "Rank issues by strategic impact, not just legal severity",
      "Operate with business-level legal intelligence on every deal",
    ],
    mockupType: "legal_strategy",
  },
};

// ─── Severity styles ──────────────────────────────────────────────────────────

const SEV_DOT: Record<ExampleSeverity, string> = {
  high:    "bg-red-500/80",
  medium:  "bg-amber-500/80",
  neutral: "bg-slate-600",
};

const SEV_TEXT: Record<ExampleSeverity, string> = {
  high:    "text-slate-300",
  medium:  "text-slate-400",
  neutral: "text-slate-500",
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
        isGuest={isGuest}
        onSignIn={isGuest ? () => openAuthModal(undefined, context) : undefined}
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
    <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-10 flex flex-col items-center text-center max-w-sm mx-auto">
      {/* Icon */}
      <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-5">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="2.5" y="1.5" width="13" height="15" rx="2" stroke="#64748b" strokeWidth="1.3" />
          <line x1="5" y1="6.5"  x2="13" y2="6.5"  stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
          <line x1="5" y1="9.5"  x2="13" y2="9.5"  stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
          <line x1="5" y1="12.5" x2="9.5" y2="12.5" stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
        </svg>
      </div>

      <h3 className="text-[15px] font-semibold text-white mb-2 tracking-tight">
        {featureName ? `Sign in to use ${featureName}` : "Sign in to continue"}
      </h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-7 max-w-[260px]">
        {featureDescription || "IndiePact is free to start. Create your account to review contracts, detect risks, and negotiate smarter."}
      </p>

      <button
        onClick={onSignIn}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-emerald-200 border border-emerald-800/50"
        style={{ background: "rgba(6,78,59,0.5)" }}
      >
        Create free account
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

      <p className="text-xs text-slate-600 mt-4">
        Already have an account?{" "}
        <button
          onClick={onSignIn}
          className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          Log in
        </button>
      </p>
      <div className="flex items-center gap-3 text-[11px] text-slate-700 mt-5">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure</span>
        <span>·</span>
        <span>No password required</span>
        <span>·</span>
        <span>Cancel anytime</span>
      </div>
    </div>
  );
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate({
  tier,
  featureName,
  isGuest,
  onSignIn,
}: {
  tier: RequiresTier;
  featureName?: string;
  isGuest: boolean;
  onSignIn?: () => void;
}) {
  const tierMeta = TIER_CTA[tier];
  const feature = featureName ? FEATURE_GATES[featureName] : null;

  const headline = feature?.headline ?? `Unlock ${featureName ?? "this feature"} on ${tierMeta.label}`;
  const sub = feature?.sub ?? "Upgrade to access this professional-grade capability.";
  const mockupType = feature?.mockupType ?? (tier === "business" ? "legal_strategy" : "ai_attorney");

  return (
    <div className="relative rounded-2xl" style={{ minHeight: 580 }}>

      {/* ── Background: blurred feature preview ──────────────────────────── */}
      {/*
        overflow-hidden on an ancestor clips filter:blur() incorrectly on
        desktop Chrome — the blurred layer bleeds outside the rounded clip
        boundary producing horizontal artifacts. Fix: contain the blur inside
        its OWN overflow-hidden div that sits independently of the outer
        rounded container, and use clip-path to hard-clip the composited
        layer before it reaches the border-radius clip.
      */}
      <div
        className="absolute inset-0 pointer-events-none select-none rounded-2xl"
        aria-hidden="true"
        style={{ overflow: "hidden", isolation: "isolate" }}
      >
        <div
          className="opacity-[0.30] origin-top"
          style={{
            filter: "blur(2px)",
            transform: "scale(1.01)",
            willChange: "auto",
          }}
        >
          {mockupType === "ai_attorney"    && <AIAttorneyMockup />}
          {mockupType === "negotiation"    && <NegotiationMockup />}
          {mockupType === "payment_lock"   && <PaymentLockMockup />}
          {mockupType === "legal_strategy" && <LegalStrategyMockup />}
        </div>
      </div>

      {/* ── Dark gradient overlay ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.68) 0%, rgba(5,5,5,0.58) 40%, rgba(5,5,5,0.86) 100%)" }}
      />

      {/* ── Gate card ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-start justify-center pt-10 pb-10 px-4 min-h-[580px]">
        <div
          className="w-full max-w-[448px] rounded-2xl p-7"
          style={{
            background: "rgba(12,12,12,0.96)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 32px 72px rgba(0,0,0,0.88), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >

          {/* ── Tier badge + price ────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-6">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700/50 text-slate-500 uppercase tracking-widest">
              <Lock className="h-2.5 w-2.5" />
              {tierMeta.label} plan
            </span>
            <span className="text-sm font-bold text-white tabular-nums">
              {tierMeta.price}
            </span>
          </div>

          {/* ── Feature icon + headline ───────────────────────────────────── */}
          <div className="flex items-start gap-3.5 mb-2.5">
            {feature && (
              <div className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-center shrink-0 mt-0.5">
                {feature.icon}
              </div>
            )}
            <h3
              className="text-[18px] font-bold text-white leading-snug tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {headline}
            </h3>
          </div>

          {/* ── Subtext ───────────────────────────────────────────────────── */}
          <p className={`text-slate-400 text-sm leading-relaxed mb-5 ${feature ? "pl-[52px]" : ""}`}>
            {sub}
          </p>

          {/* ── Example output preview ────────────────────────────────────── */}
          {feature && feature.exampleOutputs.length > 0 && (
            <div
              className="rounded-xl mb-5 p-4"
              style={{ background: "rgba(10,10,10,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3.5">
                Example output on your contract
              </p>
              <div className="space-y-2.5">
                {feature.exampleOutputs.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEV_DOT[item.severity]}`} />
                    <span className={`text-xs font-mono ${SEV_TEXT[item.severity]}`}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Outcome benefits ──────────────────────────────────────────── */}
          {feature && (
            <ul className="space-y-2.5 mb-6">
              {feature.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="text-slate-600 mt-px shrink-0 text-xs font-mono leading-5">→</span>
                  <span className="text-slate-300 leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* ── Primary CTA ───────────────────────────────────────────────── */}
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-[11px] rounded-xl font-semibold text-sm text-emerald-100 transition-all mb-2.5"
            style={{ background: "rgba(5,50,35,0.9)", border: "1px solid rgba(52,211,153,0.15)" }}
          >
            {tierMeta.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>

          {/* ── Secondary ─────────────────────────────────────────────────── */}
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-0.5 text-[12px] text-slate-600 hover:text-slate-400 transition-colors mb-3.5"
          >
            Compare all plans <ChevronRight className="h-3 w-3" />
          </Link>

          <p className="text-[11px] text-slate-700 text-center">
            No long-term contract · Cancel anytime
          </p>

          {isGuest && onSignIn && (
            <p className="text-[11px] text-slate-600 text-center mt-1.5">
              No account?{" "}
              <button
                onClick={onSignIn}
                className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Create a free account first
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Background mockup: AI Attorney ──────────────────────────────────────────
// Mimics the real clause risk matrix UI

function AIAttorneyMockup() {
  const clauses = [
    { cat: "IP Ownership",    sev: "High",   score: 24, text: "All deliverables become property of Client immediately upon creation, regardless of payment status." },
    { cat: "Scope Creep",     sev: "High",   score: 18, text: "Client may request unlimited revisions at no additional cost until fully satisfied." },
    { cat: "Payment Delay",   sev: "Medium", score: 52, text: "Payment shall be made within 60 days of invoice receipt (Net-60)." },
    { cat: "Termination",     sev: "Medium", score: 48, text: "Either party may terminate with 7 days' written notice, with no further obligation." },
    { cat: "Liability Cap",   sev: "Low",    score: 81, text: "Contractor's liability shall not exceed $500 in aggregate for any claims." },
  ];

  const sevStyle = (s: string) =>
    s === "High"   ? { badge: "bg-red-950/40 border-red-800/40 text-red-400",   dot: "bg-red-500",   bar: "#ef4444" }
    : s === "Medium" ? { badge: "bg-amber-950/40 border-amber-800/40 text-amber-400", dot: "bg-amber-500", bar: "#f59e0b" }
    : { badge: "bg-slate-800 border-slate-700 text-slate-400", dot: "bg-slate-500", bar: "#64748b" };

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Brain className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <div className="h-4 w-28 bg-slate-700 rounded" />
            <div className="h-2.5 w-20 bg-slate-800 rounded mt-1" />
          </div>
        </div>
        <div className="flex gap-1.5">
          {["All", "High", "Medium", "Low"].map(f => (
            <div key={f} className={`h-7 px-3 rounded-lg text-xs flex items-center border ${f === "All" ? "bg-slate-700 border-slate-600 text-white" : "bg-transparent border-slate-800 text-slate-600"}`}>{f}</div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Clauses", value: "5", color: "text-slate-200" },
          { label: "Critical Risk", value: "2", color: "text-red-400" },
          { label: "Negotiable",    value: "2", color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-4">
            <p className="text-[10px] text-slate-500 mb-1.5">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Clause sidebar */}
        <div className="col-span-1 space-y-2">
          {clauses.map((c, i) => {
            const s = sevStyle(c.sev);
            return (
              <div key={i} className={`rounded-xl border p-3 ${i === 0 ? "border-slate-600 bg-slate-800/50" : "border-slate-800 bg-[#0a0a0a]"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>{c.sev}</span>
                  <span className={`text-xs font-mono ${c.score < 40 ? "text-red-400" : c.score < 65 ? "text-amber-400" : "text-emerald-400"}`}>{c.score}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">{c.cat}</p>
                <div className="mt-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${c.score}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="col-span-2 space-y-3">
          <div className="rounded-2xl border border-red-900/30 bg-[#0a0a0a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">High Risk — IP Ownership</span>
            </div>
            <p className="text-xs font-mono text-slate-400 mb-4 leading-relaxed">{clauses[0].text}</p>
            <div className="p-3 rounded-xl bg-red-950/15 border border-red-900/20">
              <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Why this hurts you</p>
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-red-900/20 rounded" />
                <div className="h-2.5 w-4/5 bg-red-900/20 rounded" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-900/30 bg-[#071510] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Counter-Clause</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-emerald-900/20 rounded" />
                <div className="h-2 w-full bg-emerald-900/20 rounded" />
                <div className="h-2 w-2/3 bg-emerald-900/20 rounded" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rebuttal Script</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-slate-800 rounded" />
                <div className="h-2 w-full bg-slate-800 rounded" />
                <div className="h-2 w-3/4 bg-slate-800 rounded" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Protection Score</span>
              <span className="text-lg font-bold font-mono text-red-400">34<span className="text-xs text-slate-600">/100</span></span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: "34%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Background mockup: Negotiation War Room ──────────────────────────────────

function NegotiationMockup() {
  const rows = [
    {
      severity: "High",
      clause: '"All deliverables become property of Client immediately upon creation, regardless of payment status."',
      rewrite: "All IP transfers to Client upon receipt of full and final payment. Prior to payment, Contractor retains all rights.",
      script: "Diplomatic: Industry standard is payment-contingent IP transfer. I'd like to align with that practice.",
    },
    {
      severity: "High",
      clause: '"Client may request unlimited revisions at no additional cost until fully satisfied."',
      rewrite: "This agreement includes up to 3 revision rounds. Revisions beyond this cap are billed at $150/hr.",
      script: "Direct: Unlimited revisions create scope risk for both sides. 3 rounds ensures quality without delays.",
    },
    {
      severity: "Medium",
      clause: '"Payment shall be made within 60 days of invoice receipt (Net-60)."',
      rewrite: "Payment is due within 14 days. Unpaid balances accrue 1.5% monthly interest after the due date.",
      script: "Anchor: My standard terms are Net-14. I can move to Net-30 if the scope is adjusted accordingly.",
    },
  ];

  const sev = (s: string) =>
    s === "High" ? "text-red-400 bg-red-950/30 border-red-800/40"
                 : "text-amber-400 bg-amber-950/30 border-amber-800/40";

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Swords className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <div className="h-4 w-40 bg-slate-700 rounded" />
          <div className="h-2.5 w-24 bg-slate-800 rounded mt-1.5" />
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0a0a0a]">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Revenue Stress</span>
          <span className="text-sm font-bold font-mono text-amber-400">62</span>
          <span className="text-[10px] font-bold text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-900/30 bg-amber-950/20">MODERATE</span>
        </div>
      </div>

      {/* 3-column table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-3 bg-[#080808] border-b border-slate-800">
          {[
            { icon: <AlertTriangle className="h-3 w-3" />, label: "Flagged Clause" },
            { icon: <CheckCircle2 className="h-3 w-3" />, label: "Protective Rewrite" },
            { icon: <Scale className="h-3 w-3" />, label: "Negotiation Script" },
          ].map((col, i) => (
            <div key={i} className={`px-4 py-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${i < 2 ? "border-r border-slate-800" : ""}`}>
              {col.icon}{col.label}
            </div>
          ))}
        </div>

        {rows.map((row, i) => (
          <div key={i} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b border-slate-800" : ""}`}>
            {/* Clause */}
            <div className={`px-4 py-4 border-r border-slate-800 ${row.severity === "High" ? "bg-red-950/5" : "bg-amber-950/5"}`}>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-block mb-2 ${sev(row.severity)}`}>{row.severity}</span>
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed">{row.clause}</p>
            </div>
            {/* Rewrite */}
            <div className="px-4 py-4 border-r border-slate-800 bg-[#071510]">
              <span className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest block mb-2">Protected</span>
              <p className="text-[11px] font-mono text-emerald-400/60 leading-relaxed">{row.rewrite}</p>
            </div>
            {/* Script */}
            <div className="px-4 py-4">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Script</span>
              <p className="text-[11px] font-mono text-slate-500 leading-relaxed">{row.script}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Background mockup: Payment Lock ─────────────────────────────────────────

function PaymentLockMockup() {
  const milestones = [
    { label: "Kickoff Payment",       amount: "$4,500", date: "Due on signing",  done: true  },
    { label: "Mid-Project Milestone", amount: "$4,500", date: "Due Jun 15",      done: true  },
    { label: "Final Delivery",        amount: "$4,500", date: "Due Jul 1",       done: false },
    { label: "Revision Approval",     amount: "$1,500", date: "Due Jul 15",      done: false },
  ];

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <DollarSign className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <div className="h-4 w-28 bg-slate-700 rounded" />
          <div className="h-2.5 w-44 bg-slate-800 rounded mt-1.5" />
        </div>
      </div>

      {/* Capital summary */}
      <div className="flex items-center gap-5 px-5 py-4 rounded-xl border border-slate-800 bg-[#0a0a0a]">
        <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Capital at Stake</p>
          <p className="text-2xl font-bold font-mono text-amber-400">$15,000</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500 mb-0.5">Milestones Cleared</p>
          <p className="text-xl font-bold font-mono text-white">2<span className="text-slate-600">/4</span></p>
        </div>
      </div>

      {/* Milestone list */}
      <div className="space-y-3">
        {milestones.map((m, i) => (
          <div key={i} className={`rounded-xl border overflow-hidden ${m.done ? "border-emerald-900/25 opacity-55" : "border-slate-800"}`}>
            <div className="px-5 py-4 bg-[#0a0a0a] flex items-center gap-4">
              <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${m.done ? "border-emerald-700/60 bg-emerald-900/30" : "border-slate-700 bg-slate-900"}`}>
                {m.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${m.done ? "line-through text-slate-600" : "text-white"}`}>{m.label}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs font-mono text-amber-400">{m.amount}</span>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />{m.date}
                  </span>
                </div>
              </div>
            </div>
            {!m.done && (
              <div className="border-t border-red-900/20 bg-red-950/6 px-5 py-2.5 flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-red-500/60 shrink-0" />
                <p className="text-[11px] text-red-400/60 font-medium">
                  Stop-work trigger: pause all deliverables if payment delayed &gt;3 business days
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Background mockup: AI Legal Strategy ─────────────────────────────────────

function LegalStrategyMockup() {
  const steps = [
    { n: 1, action: "Anchor on payment terms",   tactic: "Anchor",  text: "Open with Net-14 as standard. Net-30 becomes the concession." },
    { n: 2, action: "Challenge the IP clause",   tactic: "Reframe", text: "Frame IP transfer as payment-contingent — position as industry standard." },
    { n: 3, action: "Cap the revision scope",    tactic: "Trade",   text: "Offer 3 rounds in exchange for removing the unlimited revisions clause." },
  ];

  return (
    <div className="bg-[#050505] min-h-[700px] p-6 space-y-5">
      {/* Assessment */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-emerald-400/70" />
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
            <Scale className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">Your Negotiating Position</span>
          </div>
          <span className="text-base font-bold font-mono text-amber-400">Moderate</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
          <span>Unfavorable</span><span>Balanced</span><span>Strong</span>
        </div>
        <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="absolute h-full rounded-full bg-amber-500" style={{ width: "52%" }} />
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-[10px] text-slate-700">0</span>
          <span className="text-sm font-bold font-mono text-amber-400">52/100</span>
          <span className="text-[10px] text-slate-700">100</span>
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
            { rank: 2, title: "IP Transfer on Creation",    urgency: "High" },
            { rank: 3, title: "Net-60 Payment Terms",       urgency: "Moderate" },
          ].map(r => (
            <div key={r.rank} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3 flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">{r.rank}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{r.title}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-1 inline-block
                  ${r.urgency === "Immediate" ? "bg-red-950/20 border-red-900/30 text-red-300/80"
                  : r.urgency === "High" ? "bg-amber-950/20 border-amber-900/30 text-amber-300/80"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400"}`}>{r.urgency}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Negotiation steps */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5 text-emerald-400" /> Negotiation Order
          </h4>
          {steps.map(s => (
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

      {/* Checklist */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Pre-Signing Checklist</span>
          <span className="text-[10px] text-slate-500 font-mono">0/7 complete</span>
        </div>
        <div className="space-y-2">
          {[65, 82, 55, 73].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-4 w-4 rounded border border-slate-700 bg-slate-800/60 shrink-0" />
              <div className="h-2.5 bg-slate-800 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
