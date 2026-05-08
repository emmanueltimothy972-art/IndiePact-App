import { useMemo } from "react";
import { ScanResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, XCircle, DollarSign, Clock, ShieldAlert, TrendingDown } from "lucide-react";

type Risk = {
  title: string;
  severity: "Low" | "Medium" | "High";
  category: string;
  explanation: string;
  whyThisHurtsYou: string;
  fixes: { rewrittenClause: string; direct: string; diplomatic: string; legal: string };
};

const PAYMENT_RECOMMENDATIONS = [
  {
    term: "50% Upfront Deposit",
    description: "Non-negotiable. Payable before any work commences. Protects against client abandonment.",
    clause: "A non-refundable deposit of 50% of the total project fee shall be paid prior to commencement of any work. This deposit secures the Contractor's calendar and materials.",
  },
  {
    term: "Milestone-Based Payments",
    description: "Tie payments to deliverable completion, not client approval. Eliminates indefinite hold.",
    clause: "Remaining balance shall be paid upon delivery of each milestone as defined in Schedule A, within seven (7) calendar days of delivery, regardless of the Client's review status.",
  },
  {
    term: "Late Fee Penalty (1.5%/month)",
    description: "Automatically applies to unpaid invoices. Creates financial incentive for on-time payment.",
    clause: "Invoices not paid within the agreed payment period shall accrue a late payment fee of 1.5% per month (18% per annum) on the outstanding balance, compounded monthly.",
  },
  {
    term: "Work Suspension Clause",
    description: "Right to halt all work after 14 days of non-payment without penalty.",
    clause: "Contractor reserves the right to suspend all services without penalty if payment is not received within fourteen (14) calendar days of the due date, with all rights to deliverables retained until full payment is received.",
  },
];

export function RevenueStressTest({ result }: { result: ScanResult }) {
  const risks = (result.risks || []) as Risk[];

  const analysis = useMemo(() => {
    let rating = 100;
    const flags: { label: string; severity: "high" | "medium" | "low"; description: string }[] = [];

    const paymentRisks = risks.filter((r) => r.category === "paymentDelay");
    const scopeRisks = risks.filter((r) => r.category === "scopeCreep");
    const liabilityRisks = risks.filter((r) => r.category === "liability");
    const terminationRisks = risks.filter((r) => r.category === "termination");

    for (const r of paymentRisks) {
      if (r.severity === "High") {
        rating -= 30;
        flags.push({ label: "Delayed Payment Trap", severity: "high", description: r.explanation });
      } else if (r.severity === "Medium") {
        rating -= 18;
        flags.push({ label: "Payment Friction Risk", severity: "medium", description: r.explanation });
      } else {
        rating -= 8;
        flags.push({ label: "Payment Term Observation", severity: "low", description: r.explanation });
      }
    }

    for (const r of scopeRisks) {
      if (r.severity === "High") {
        rating -= 22;
        flags.push({ label: "Scope Creep Trigger Detected", severity: "high", description: r.explanation });
      } else if (r.severity === "Medium") {
        rating -= 12;
        flags.push({ label: "Scope Expansion Risk", severity: "medium", description: r.explanation });
      } else {
        rating -= 5;
        flags.push({ label: "Scope Ambiguity Noted", severity: "low", description: r.explanation });
      }
    }

    for (const r of liabilityRisks) {
      if (r.severity === "High") {
        rating -= 25;
        flags.push({ label: "Liability Without Limit", severity: "high", description: r.explanation });
      } else if (r.severity === "Medium") {
        rating -= 14;
        flags.push({ label: "Uncapped Liability Exposure", severity: "medium", description: r.explanation });
      }
    }

    for (const r of terminationRisks) {
      if (r.severity === "High") {
        rating -= 20;
        flags.push({ label: "Unilateral Termination Without Pay", severity: "high", description: r.explanation });
      } else if (r.severity === "Medium") {
        rating -= 10;
        flags.push({ label: "Termination Exposure", severity: "medium", description: r.explanation });
      }
    }

    rating = Math.max(0, Math.min(100, rating));

    return { rating, flags };
  }, [risks]);

  const { rating, flags } = analysis;

  const gaugeColor = rating >= 70 ? "#10b981" : rating >= 40 ? "#f59e0b" : "#ef4444";
  const gaugeLabel = rating >= 70 ? "LOW FRICTION" : rating >= 40 ? "MODERATE RISK" : "HIGH EXPOSURE";
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (circumference * rating) / 100;

  return (
    <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-[#050505] flex items-center gap-3">
        <TrendingDown className="h-5 w-5 text-amber-400" />
        <div>
          <h2 className="text-base font-bold tracking-tight font-mono">REVENUE STRESS TEST</h2>
          <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">Payment Friction & Financial Leakage Analysis</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gauge */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${gaugeColor}60)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-bold tabular-nums" style={{ color: gaugeColor }}>{rating}</span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">/ 100</span>
            </div>
          </div>
          <div>
            <span
              className="block text-center text-xs font-mono font-bold px-3 py-1 rounded border uppercase tracking-widest"
              style={{ color: gaugeColor, borderColor: `${gaugeColor}40`, backgroundColor: `${gaugeColor}10` }}
            >
              {gaugeLabel}
            </span>
            <p className="text-[11px] text-muted-foreground font-mono text-center mt-2">Revenue Safety Rating</p>
          </div>
        </div>

        {/* Detected flags */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground pb-2 border-b border-border">
            Detected Friction Points
          </h3>
          {flags.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono">
              <CheckCircle2 className="h-4 w-4" />
              No payment friction detected
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {flags.map((flag, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
                    flag.severity === "high"
                      ? "border-red-800/50 bg-red-950/20 text-red-300"
                      : flag.severity === "medium"
                      ? "border-amber-800/40 bg-amber-950/15 text-amber-300"
                      : "border-border bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {flag.severity === "high" ? <XCircle className="h-3 w-3 shrink-0" /> :
                     flag.severity === "medium" ? <AlertTriangle className="h-3 w-3 shrink-0" /> :
                     <DollarSign className="h-3 w-3 shrink-0" />}
                    <span className="font-bold">{flag.label}</span>
                  </div>
                  <p className="text-[10px] opacity-80 pl-5 leading-relaxed">{flag.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mandatory terms */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground pb-2 border-b border-border">
            Mandatory Protective Terms
          </h3>
          <div className="space-y-2">
            {PAYMENT_RECOMMENDATIONS.map((rec, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between gap-2 cursor-pointer list-none p-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-mono font-semibold text-emerald-300">{rec.term}</span>
                  </div>
                  <Clock className="h-3 w-3 text-muted-foreground group-open:hidden shrink-0" />
                </summary>
                <div className="mt-1.5 p-3 rounded-lg border border-border bg-card mx-0.5">
                  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{rec.description}</p>
                  <p className="text-[10px] font-mono text-slate-300 leading-relaxed italic border-l-2 border-emerald-800 pl-2">
                    "{rec.clause}"
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
