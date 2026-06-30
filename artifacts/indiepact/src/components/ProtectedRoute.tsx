import { ReactNode } from "react";
import { Loader2, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When provided, the gate shows a feature-specific blurred preview. */
  featureName?: string;
  /** Tier label shown in the badge, e.g. "Pro". Defaults to "Pro". */
  featureTier?: string;
}

export function ProtectedRoute({ children, featureName, featureTier = "Pro" }: ProtectedRouteProps) {
  const { isLoading, isGuest, openAuthModal } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-slate-600 animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <GuestGate
        featureName={featureName}
        featureTier={featureTier}
        onSignIn={() => openAuthModal()}
      />
    );
  }

  return <>{children}</>;
}

// ─── Guest gate ───────────────────────────────────────────────────────────────
// Shown when a guest visits a premium route (before plan-tier check in FeatureGate).

function GuestGate({
  featureName,
  featureTier,
  onSignIn,
}: {
  featureName?: string;
  featureTier: string;
  onSignIn: () => void;
}) {
  const mockup = featureName ? FEATURE_MOCKUP[featureName] : null;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 560 }}>

      {/* ── Blurred feature preview ───────────────────────────────────────── */}
      {mockup && (
        <>
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
            <div className="opacity-[0.28] blur-[2.5px] scale-[1.01] origin-top">
              {mockup}
            </div>
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.70) 0%, rgba(5,5,5,0.60) 40%, rgba(5,5,5,0.88) 100%)" }}
          />
        </>
      )}

      {/* ── Gate card ─────────────────────────────────────────────────────── */}
      <div className={`relative z-10 flex items-start justify-center px-4 min-h-[560px] ${mockup ? "pt-10 pb-10" : "pt-20 pb-20"}`}>
        <div
          className="w-full max-w-[420px] rounded-2xl p-7"
          style={{
            background: mockup ? "rgba(12,12,12,0.96)" : "rgba(10,10,10,1)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 32px 72px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >
          {/* Plan badge */}
          <div className="flex items-center justify-between mb-6">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700/50 text-slate-500 uppercase tracking-widest">
              <Lock className="h-2.5 w-2.5" />
              {featureTier} plan
            </span>
          </div>

          {/* Headline */}
          <h3
            className="text-[18px] font-bold text-white leading-snug tracking-tight mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            {featureName
              ? `Sign in to use ${featureName}`
              : "Sign in to continue"}
          </h3>

          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            {FEATURE_SUB[featureName ?? ""] ??
              "IndiePact is free to start. Create your account to review contracts, detect risks, and negotiate smarter."}
          </p>

          {/* CTA */}
          <button
            onClick={onSignIn}
            className="flex items-center justify-center gap-2 w-full py-[11px] rounded-xl font-semibold text-sm text-emerald-100 transition-all mb-2.5"
            style={{ background: "rgba(5,50,35,0.9)", border: "1px solid rgba(52,211,153,0.15)" }}
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-center text-xs text-slate-600 mb-3">
            Already have an account?{" "}
            <button
              onClick={onSignIn}
              className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              Log in
            </button>
          </p>

          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-700">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure</span>
            <span>·</span>
            <span>No password required</span>
            <span>·</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature-specific subtext (short auth-focused version) ────────────────────

const FEATURE_SUB: Record<string, string> = {
  "Contract Intelligence":
    "Sign in to identify hidden contract risks, detect dangerous clauses, and receive rewrite recommendations before signing.",
  "Negotiation War Room":
    "Sign in to generate leverage-focused negotiation responses, counter risky clauses, and prepare before every deal.",
  "Payment Lock":
    "Sign in to protect milestones, reduce scope creep, and strengthen payment enforcement before work begins.",
  "Clause Armory":
    "Sign in to access battle-tested protective clauses built for freelancers and consultants.",
  "Contract Strategy":
    "Sign in to analyze your negotiating position, rank priority risks, and build a strategic playbook for any deal.",
};

// ─── Feature-specific blurred preview mockups ─────────────────────────────────
// Inline JSX per feature name. Keep markup lean — it will be blurred and faded.

const FEATURE_MOCKUP: Record<string, ReactNode> = {
  "Contract Intelligence": <AIAttorneyPreview />,
  "Negotiation War Room": <NegotiationPreview />,
  "Payment Lock": <PaymentLockPreview />,
  "Clause Armory": <AIAttorneyPreview />,
  "Contract Strategy": <LegalStrategyPreview />,
};

// ─── Preview components ───────────────────────────────────────────────────────

function AIAttorneyPreview() {
  const rows = [
    { cat: "IP Ownership",  sev: "High",   score: 24, bar: "#ef4444" },
    { cat: "Scope Creep",   sev: "High",   score: 18, bar: "#ef4444" },
    { cat: "Payment Delay", sev: "Medium", score: 52, bar: "#f59e0b" },
    { cat: "Termination",   sev: "Medium", score: 48, bar: "#f59e0b" },
    { cat: "Liability Cap", sev: "Low",    score: 81, bar: "#64748b" },
  ];

  return (
    <div className="bg-[#050505] min-h-[640px] p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-slate-800" />
          <div className="space-y-1"><div className="h-3.5 w-24 bg-slate-700 rounded" /><div className="h-2.5 w-16 bg-slate-800 rounded" /></div>
        </div>
        <div className="flex gap-1.5">
          {["All","High","Medium","Low"].map(f=>(
            <div key={f} className={`h-6 px-3 rounded-lg text-[11px] flex items-center border ${f==="All"?"bg-slate-700 border-slate-600 text-white":"border-slate-800 text-slate-700"}`}>{f}</div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-2">
        {[["Clauses","5","text-slate-200"],["Critical","2","text-red-400"],["Negotiable","2","text-amber-400"]].map(([l,v,c])=>(
          <div key={l} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3">
            <p className="text-[10px] text-slate-600 mb-1">{l}</p>
            <p className={`text-xl font-bold font-mono ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 space-y-2">
          {rows.map((r,i)=>(
            <div key={i} className={`rounded-xl border p-3 ${i===0?"border-slate-600 bg-slate-800/40":"border-slate-800 bg-[#0a0a0a]"}`}>
              <div className="flex justify-between mb-1">
                <span className={`text-[9px] font-bold px-1.5 rounded-full ${r.sev==="High"?"text-red-400 bg-red-950/40":r.sev==="Medium"?"text-amber-400 bg-amber-950/40":"text-slate-400 bg-slate-800"}`}>{r.sev}</span>
                <span className="text-[10px] font-mono" style={{color:r.bar}}>{r.score}</span>
              </div>
              <p className="text-[11px] text-slate-400">{r.cat}</p>
              <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{width:`${r.score}%`,background:r.bar}} />
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-2 space-y-3">
          <div className="rounded-2xl border border-red-900/30 bg-[#0a0a0a] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">High Risk — IP Ownership</span>
            </div>
            <div className="space-y-1.5 mb-3">
              <div className="h-2.5 w-full bg-slate-800 rounded" />
              <div className="h-2.5 w-4/5 bg-slate-800 rounded" />
              <div className="h-2.5 w-3/5 bg-slate-800 rounded" />
            </div>
            <div className="p-3 rounded-xl bg-red-950/15 border border-red-900/20">
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-red-900/20 rounded" />
                <div className="h-2 w-3/4 bg-red-900/20 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-900/30 bg-[#071510] p-3">
              <p className="text-[9px] font-bold text-emerald-500/70 uppercase mb-2">Counter-Clause</p>
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-emerald-900/20 rounded" />
                <div className="h-2 w-2/3 bg-emerald-900/20 rounded" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Rebuttal Script</p>
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-slate-800 rounded" />
                <div className="h-2 w-3/4 bg-slate-800 rounded" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Protection Score</span>
              <span className="text-base font-bold font-mono text-red-400">34<span className="text-[10px] text-slate-600">/100</span></span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{width:"34%"}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NegotiationPreview() {
  const rows = [
    { sev: "High",   clause: '"All deliverables become property of Client immediately upon creation."', rewrite: "IP transfers to Client upon receipt of full payment.", script: "Diplomatic: Industry standard is payment-contingent IP transfer." },
    { sev: "High",   clause: '"Client may request unlimited revisions at no additional cost."',          rewrite: "3 revision rounds included. Additional billed at $150/hr.",  script: "Direct: 3 rounds ensures quality without scope risk." },
    { sev: "Medium", clause: '"Payment shall be made within 60 days of invoice receipt (Net-60)."',     rewrite: "Payment due in 14 days. Late balances accrue 1.5%/month.",  script: "Anchor: My standard is Net-14; I can move to Net-30 if scope adjusts." },
  ];

  return (
    <div className="bg-[#050505] min-h-[640px] p-6 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <div className="h-7 w-7 rounded-lg bg-slate-800" />
        <div className="space-y-1"><div className="h-3.5 w-44 bg-slate-700 rounded" /><div className="h-2.5 w-24 bg-slate-800 rounded" /></div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0a0a0a]">
          <span className="text-[9px] font-mono text-slate-600 uppercase">Revenue Stress</span>
          <span className="text-sm font-bold font-mono text-amber-400">62</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-3 bg-[#080808] border-b border-slate-800">
          {["Flagged Clause","Protective Rewrite","Negotiation Script"].map((h,i)=>(
            <div key={i} className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 ${i<2?"border-r border-slate-800":""}`}>{h}</div>
          ))}
        </div>
        {rows.map((row,i)=>(
          <div key={i} className={`grid grid-cols-3 ${i<rows.length-1?"border-b border-slate-800":""}`}>
            <div className={`px-3 py-3 border-r border-slate-800 ${row.sev==="High"?"bg-red-950/5":"bg-amber-950/5"} space-y-1.5`}>
              <span className={`text-[9px] font-bold px-1.5 rounded-full inline-block ${row.sev==="High"?"text-red-400 bg-red-950/30":"text-amber-400 bg-amber-950/30"}`}>{row.sev}</span>
              <p className="text-[10px] font-mono text-slate-400 leading-relaxed">{row.clause}</p>
            </div>
            <div className="px-3 py-3 border-r border-slate-800 bg-[#071510] space-y-1.5">
              <span className="text-[9px] font-bold text-emerald-500/70 uppercase block">Protected</span>
              <p className="text-[10px] font-mono text-emerald-400/60 leading-relaxed">{row.rewrite}</p>
            </div>
            <div className="px-3 py-3 space-y-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Script</span>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{row.script}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentLockPreview() {
  const items = [
    { label: "Kickoff Payment",       amount: "$4,500", date: "Due on signing", done: true  },
    { label: "Mid-Project Milestone", amount: "$4,500", date: "Due Jun 15",     done: true  },
    { label: "Final Delivery",        amount: "$4,500", date: "Due Jul 1",      done: false },
    { label: "Revision Approval",     amount: "$1,500", date: "Due Jul 15",     done: false },
  ];

  return (
    <div className="bg-[#050505] min-h-[640px] p-6 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <div className="h-7 w-7 rounded-lg bg-slate-800" />
        <div className="space-y-1"><div className="h-3.5 w-28 bg-slate-700 rounded" /><div className="h-2.5 w-44 bg-slate-800 rounded" /></div>
      </div>
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-slate-800 bg-[#0a0a0a]">
        <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <span className="text-amber-400 text-lg font-bold">$</span>
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
      <div className="space-y-3">
        {items.map((m,i)=>(
          <div key={i} className={`rounded-xl border overflow-hidden ${m.done?"border-emerald-900/25 opacity-55":"border-slate-800"}`}>
            <div className="px-4 py-3.5 bg-[#0a0a0a] flex items-center gap-3">
              <div className={`h-4 w-4 rounded border shrink-0 ${m.done?"border-emerald-700/60 bg-emerald-900/30":"border-slate-700 bg-slate-900"}`} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${m.done?"line-through text-slate-600":"text-white"}`}>{m.label}</p>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <span className="text-xs font-mono text-amber-400">{m.amount}</span>
                  <span className="text-xs text-slate-600">{m.date}</span>
                </div>
              </div>
            </div>
            {!m.done&&(
              <div className="border-t border-red-900/20 bg-red-950/6 px-4 py-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500/60 shrink-0" />
                <p className="text-[10px] text-red-400/60">Stop-work trigger active if payment delayed &gt;3 days</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LegalStrategyPreview() {
  return (
    <div className="bg-[#050505] min-h-[640px] p-6 space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded-full bg-emerald-500/30" />
          <span className="text-sm font-semibold text-white">Strategic Assessment</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-800 rounded" />
          <div className="h-3 w-5/6 bg-slate-800 rounded" />
          <div className="h-3 w-4/5 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-white">Your Negotiating Position</span>
          <span className="text-base font-bold font-mono text-amber-400">Moderate</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
          <span>Unfavorable</span><span>Balanced</span><span>Strong</span>
        </div>
        <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="absolute h-full rounded-full bg-amber-500" style={{width:"52%"}} />
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-[10px] text-slate-700">0</span>
          <span className="text-sm font-bold font-mono text-amber-400">52/100</span>
          <span className="text-[10px] text-slate-700">100</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-white uppercase tracking-wider">Priority Issues</p>
          {[
            { n:1, t:"Unlimited Revisions",   u:"Immediate" },
            { n:2, t:"IP Transfer on Creation",u:"High"      },
            { n:3, t:"Net-60 Payment Terms",   u:"Moderate"  },
          ].map(r=>(
            <div key={r.n} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3 flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">{r.n}</div>
              <div>
                <p className="text-[11px] font-medium text-white">{r.t}</p>
                <span className={`text-[9px] font-bold px-1.5 rounded-full inline-block mt-0.5 ${r.u==="Immediate"?"text-red-300/80 bg-red-950/20":r.u==="High"?"text-amber-300/80 bg-amber-950/20":"text-slate-400 bg-slate-800/50"}`}>{r.u}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-white uppercase tracking-wider">Negotiation Order</p>
          {[
            { n:1, a:"Anchor payment terms",  t:"Anchor"  },
            { n:2, a:"Challenge IP clause",    t:"Reframe" },
            { n:3, a:"Cap revision scope",     t:"Trade"   },
          ].map(s=>(
            <div key={s.n} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-emerald-900/40 border border-emerald-800/50 flex items-center justify-center text-[9px] font-bold text-emerald-400">{s.n}</div>
                  <span className="text-[11px] font-semibold text-white">{s.a}</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 rounded-full border bg-slate-800/60 border-slate-700/60 text-slate-400">{s.t}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
