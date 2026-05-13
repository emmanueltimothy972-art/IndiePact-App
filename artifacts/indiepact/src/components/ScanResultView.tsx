import { ScanResult } from "@workspace/api-client-react";
import { RiskCard } from "./RiskCard";
import { RevenueStressTest } from "./RevenueStressTest";
import { DollarSign, Target, ArrowRight, Trophy, Lock, Download, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isPaidPlan, canExport } from "@/lib/constants";
import { Link } from "wouter";

const DEFAULT_STEPS = [
  "Request a 48-hour review period before signing — this is standard and non-negotiable.",
  "Prioritize your top 2 concerns and send written amendment proposals via email to create a paper trail.",
  "If the counterparty refuses all amendments, assess whether the engagement is worth the financial exposure.",
];

export function ScanResultView({ result }: { result: ScanResult }) {
  const { userPlan } = useAuth();
  const isPro = isPaidPlan(userPlan);
  const exportEnabled = canExport(userPlan);

  const extended = result as ScanResult & { pathToVictory?: string[] };
  const steps: string[] = extended.pathToVictory?.length ? extended.pathToVictory : DEFAULT_STEPS;
  const riskMin = result.revenueAtRiskMin ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Executive summary + protection score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-border bg-card rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Executive Summary</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {result.moneyImpactSummary}
              </p>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <h3 className="text-sm font-medium text-muted-foreground mb-4 relative z-10">Protection Score</h3>
          <div className="relative z-10 w-32 h-32 flex items-center justify-center mb-4">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
              <circle
                cx="64" cy="64" r="56"
                fill="none" stroke="currentColor" strokeWidth="8"
                strokeDasharray="351.86"
                strokeDashoffset={351.86 - (351.86 * result.protectionScore) / 100}
                className={result.protectionScore > 75 ? "text-chart-1" : result.protectionScore > 50 ? "text-chart-3" : "text-destructive"}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-4xl font-bold font-mono tracking-tighter">{result.protectionScore}</div>
          </div>

          {/* Export button — only on export-enabled plans */}
          {exportEnabled ? (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/40 hover:border-emerald-700/60 px-3 py-1.5 rounded-lg transition-all relative z-10"
            >
              <Download className="h-3 w-3" /> Export Report
            </button>
          ) : (
            <Link href="/pricing" className="relative z-10">
              <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-amber-400 border border-slate-800 hover:border-amber-800/40 px-3 py-1.5 rounded-lg transition-all">
                <Lock className="h-3 w-3 text-[#D4AF37]" /> Export — from $9.99
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Revenue at risk */}
      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-10 text-destructive">
          <DollarSign className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-destructive font-semibold flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5" />
              Revenue at Risk
            </h3>
            <p className="text-muted-foreground">
              We found estimated financial exposure if these clauses are exercised against you.
            </p>
          </div>
          <div className="text-4xl md:text-5xl font-bold font-mono text-destructive tracking-tight">
            ${result.revenueAtRiskMin.toLocaleString()} – ${result.revenueAtRiskMax.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Revenue Stress Test */}
      <RevenueStressTest result={result} />

      {/* Strategic Observations — Legal Audit Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Legal Audit Findings</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 uppercase tracking-widest">
                Clause-by-clause forensic review
              </p>
            </div>
          </div>
          <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium font-mono">
            {result.risks.length} finding{result.risks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Summary table header */}
        {result.risks.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden mb-2">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#050505] border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-muted-foreground uppercase tracking-widest font-medium w-6">#</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground uppercase tracking-widest font-medium">Finding</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground uppercase tracking-widest font-medium">Category</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground uppercase tracking-widest font-medium">Severity</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground uppercase tracking-widest font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {result.risks.map((risk, idx) => (
                  <tr key={idx} className={`border-b border-border/50 last:border-0 ${idx % 2 === 0 ? "bg-card/40" : "bg-card/20"}`}>
                    <td className="px-4 py-2 text-muted-foreground">{String(idx + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-2 text-foreground max-w-xs truncate" title={risk.title}>{risk.title}</td>
                    <td className="px-4 py-2 text-muted-foreground">{risk.category}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        risk.severity === "High" ? "bg-destructive/10 text-destructive border-destructive/20" :
                        risk.severity === "Medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-primary/10 text-primary border-primary/20"
                      }`}>
                        {risk.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {risk.severity === "High" ? "25" : risk.severity === "Medium" ? "55" : "80"}/100
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {result.risks.map((risk, idx) => (
            <RiskCard key={idx} risk={risk} />
          ))}
        </div>
      </div>

      {/* Path to Victory */}
      <div className="relative border border-primary/30 bg-primary/5 rounded-xl p-6 shadow-sm overflow-hidden">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2 text-primary">
          <Trophy className="h-6 w-6 text-primary" />
          Path to Victory
        </h2>

        {isPro ? (
          <ol className="list-decimal pl-6 space-y-3 text-muted-foreground text-base">
            {steps.map((step, idx) => (
              <li key={idx} className="pl-2">{step}</li>
            ))}
          </ol>
        ) : (
          <div className="relative">
            <ol className="list-decimal pl-6 space-y-3 text-muted-foreground text-base select-none pointer-events-none" style={{ filter: "blur(5px)" }}>
              {steps.map((step, idx) => (
                <li key={idx} className="pl-2">{step}</li>
              ))}
            </ol>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0E14]/80 rounded-lg backdrop-blur-sm">
              <Lock className="h-7 w-7 text-[#D4AF37] mb-3" />
              <p className="text-sm font-semibold text-foreground text-center mb-1">
                You should act on <span className="text-[#D4AF37]">${riskMin.toLocaleString()}</span> in identified risk.
              </p>
              <p className="text-xs text-muted-foreground text-center mb-4 max-w-xs">
                Unlock your full negotiation scripts and PDF forensic report.
              </p>
              <Link href="/pricing">
                <button className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0B0E14] font-bold text-sm px-5 py-2 rounded-md transition-colors">
                  Unlock — from $9.99
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Recommended next step */}
      <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          Recommended Next Step
        </h2>
        <p className="text-muted-foreground text-lg">{result.nextStep}</p>
      </div>
    </div>
  );
}
