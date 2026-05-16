import { PageTransition } from "@/components/PageTransition";
import { useListScans, getListScansQueryKey } from "@workspace/api-client-react";
import {
  Scale, ArrowRight, ShieldAlert, Loader2, Brain, FileText,
  AlertTriangle, CheckCircle2, Shield, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useScanContext } from "@/contexts/ScanContext";
import { isPaidPlan } from "@/lib/constants";
import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";

type Risk = {
  title?: string;
  explanation?: string;
  category: string;
  severity: "Low" | "Medium" | "High";
  whyThisHurtsYou?: string;
  fixes?: { rewrittenClause?: string; direct?: string; diplomatic?: string; legal?: string };
};

const MOCK_RISKS: Risk[] = [
  {
    explanation: "\"All deliverables become property of Client immediately upon creation, regardless of payment status.\"",
    category: "IP Ownership",
    severity: "High",
    whyThisHurtsYou: "You lose all IP rights the moment you start work — even if you never get paid.",
    fixes: {
      rewrittenClause: "All intellectual property transfers to Client upon receipt of full and final payment. Prior to full payment, Contractor retains all rights, title, and interest in all deliverables.",
    },
  },
  {
    explanation: "\"Client may request unlimited revisions at no additional cost until fully satisfied.\"",
    category: "Scope Creep",
    severity: "High",
    whyThisHurtsYou: "Open-ended revision clauses allow clients to demand infinite work without extra pay.",
    fixes: {
      rewrittenClause: "This agreement includes up to 3 revision rounds per milestone. Revisions beyond this cap are billed at $150/hour, invoiced separately, and require written approval before work begins.",
    },
  },
  {
    explanation: "\"Payment shall be made within 60 days of invoice receipt (Net-60).\"",
    category: "Payment Delay",
    severity: "Medium",
    whyThisHurtsYou: "Net-60 terms can leave you cash-flow negative for two months while working actively.",
    fixes: {
      rewrittenClause: "Payment is due within 14 days of invoice date. Unpaid balances accrue interest at 1.5% per month (18% annually) after the due date.",
    },
  },
  {
    explanation: "\"Either party may terminate this agreement with 7 days' written notice, with no further obligation.\"",
    category: "Termination Risk",
    severity: "Medium",
    whyThisHurtsYou: "Client can exit mid-project with zero financial consequence, leaving you uncompensated.",
    fixes: {
      rewrittenClause: "If Client terminates without cause, Client shall pay a kill fee equal to 50% of remaining contract value within 7 business days of termination notice.",
    },
  },
  {
    explanation: "\"Contractor's liability shall not exceed $500 in aggregate for any claims.\"",
    category: "Liability Cap",
    severity: "Low",
    whyThisHurtsYou: "A hard dollar cap on your liability is actually protective — but the amount should reflect contract value.",
    fixes: {
      rewrittenClause: "Contractor's total liability shall not exceed the total fees paid under this agreement in the 3 months preceding the claim.",
    },
  },
];

function riskScore(severity: string): number {
  if (severity === "High") return 24;
  if (severity === "Medium") return 52;
  return 81;
}

function leveragePriority(severity: string): { label: string; className: string } {
  if (severity === "High") return { label: "Address First", className: "bg-red-950/40 border-red-800/40 text-red-400" };
  if (severity === "Medium") return { label: "Negotiate", className: "bg-amber-950/40 border-amber-800/40 text-amber-400" };
  return { label: "Monitor", className: "bg-slate-800 border-slate-700 text-slate-400" };
}

function severityBadge(severity: string): string {
  if (severity === "High") return "bg-red-950/30 border-red-900/40 text-red-400";
  if (severity === "Medium") return "bg-amber-950/30 border-amber-900/40 text-amber-400";
  return "bg-slate-800 border-slate-700 text-slate-400";
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#059669" : score >= 45 ? "#d97706" : "#dc2626";
  return (
    <div className="relative h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute left-0 top-0 h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export default function TheBar() {
  const { userId, userPlan } = useAuth();
  const { activeScan, cachedScans } = useScanContext();
  const [selectedRiskIdx, setSelectedRiskIdx] = useState(0);

  const { data, isLoading } = useListScans(
    { userId, limit: 1, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId, limit: 1, offset: 0 }), retry: 1 } }
  );

  const hasPaid = isPaidPlan(userPlan);

  // Priority: activeScan → cachedScans[0] → API → mock
  const sourceScan = (() => {
    if (activeScan?.result?.risks?.length) return { contractName: activeScan.contractName, result: activeScan.result };
    if (cachedScans.length > 0 && (cachedScans[0].result as { risks?: Risk[] })?.risks?.length) return cachedScans[0] as { contractName: string; result: { risks: Risk[]; protectionScore: number } };
    if (data?.scans?.[0]) return data.scans[0] as { contractName: string; result: { risks: Risk[]; protectionScore: number } };
    return null;
  })();

  const liveRisks: Risk[] = (sourceScan?.result?.risks as Risk[] | undefined) ?? [];
  const isUsingReal = liveRisks.length > 0;
  const risks: Risk[] = isUsingReal ? liveRisks : (hasPaid ? MOCK_RISKS : []);

  const selectedRisk = risks[selectedRiskIdx] ?? null;
  const highCount = risks.filter((r) => r.severity === "High").length;
  const medCount = risks.filter((r) => r.severity === "Medium").length;

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">AI Attorney</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider">
                Pro
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Clause-by-clause risk intelligence — scored, explained, and ready to counter.
            </p>
          </div>
          {isUsingReal && sourceScan && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">Analyzing</p>
              <p className="text-xs text-slate-300 font-medium truncate max-w-48">{sourceScan.contractName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Data source banner */}
      {!isUsingReal && hasPaid && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-900/60 text-xs text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0" />
          Showing sample clause data — review a contract to populate with your real clause intelligence.
          <Link href="/scan" className="ml-auto text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors whitespace-nowrap">
            Review a contract
          </Link>
        </div>
      )}

      {isLoading && !sourceScan ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-slate-500 h-6 w-6" />
        </div>
      ) : risks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <FileText className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No clause data yet</p>
          <p className="text-slate-600 text-sm mb-5">
            Review a contract first to get clause-by-clause risk intelligence here.
          </p>
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
          >
            <FileText className="h-4 w-4" />
            Review a Contract
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Total Clauses",
                value: risks.length,
                icon: <Scale className="h-4 w-4 text-slate-400" />,
                sub: "flagged issues",
              },
              {
                label: "Critical Risk",
                value: highCount,
                icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
                sub: "address immediately",
                valueClass: highCount > 0 ? "text-red-400" : "text-slate-300",
              },
              {
                label: "Negotiable",
                value: medCount,
                icon: <TrendingUp className="h-4 w-4 text-amber-400" />,
                sub: "can be improved",
                valueClass: "text-amber-400",
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {stat.icon}
                  {stat.label}
                </div>
                <p className={`text-2xl font-bold font-mono ${stat.valueClass ?? "text-slate-200"}`}>
                  {stat.value}
                </p>
                <p className="text-[10px] text-slate-600">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Risk Scoring Matrix */}
          <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-white text-sm">Clause Risk Matrix</h2>
              <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
                {risks.length} clause{risks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-600 uppercase tracking-widest bg-slate-900/50 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Clause Excerpt</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Severity</th>
                    <th className="px-5 py-3 font-semibold">Risk Score</th>
                    <th className="px-5 py-3 font-semibold">Priority</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((risk, idx) => {
                    const score = riskScore(risk.severity);
                    const prio = leveragePriority(risk.severity);
                    const isSelected = selectedRiskIdx === idx;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedRiskIdx(idx)}
                        className={`border-b border-slate-800/60 last:border-0 cursor-pointer transition-colors ${
                          isSelected ? "bg-slate-800/40" : "hover:bg-slate-900/60"
                        }`}
                      >
                        <td className="px-5 py-4 font-mono text-xs text-slate-400 max-w-xs">
                          <span className="line-clamp-2 leading-relaxed">
                            {risk.explanation || risk.title || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-300">{risk.category}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityBadge(risk.severity)}`}>
                            {risk.severity}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold ${score < 35 ? "text-red-400" : score < 65 ? "text-amber-400" : "text-emerald-500"}`}>
                              {score}
                            </span>
                            <ScoreBar score={score} />
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prio.className}`}>
                            {prio.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setSelectedRiskIdx(idx); }}
                            className="h-7 px-3 text-[11px] border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparison Engine */}
          {selectedRisk && (
            <motion.div
              key={selectedRiskIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                <TrendingDown className="h-4 w-4 text-slate-500" />
                <h2 className="font-semibold text-white text-sm">
                  Clause Deep-Dive — <span className="text-slate-400 font-normal">{selectedRisk.category}</span>
                </h2>
              </div>

              {/* Why it hurts */}
              {selectedRisk.whyThisHurtsYou && (
                <div className="rounded-xl border border-amber-900/30 bg-amber-950/5 px-5 py-4 text-sm text-amber-300/80 leading-relaxed">
                  <span className="font-semibold text-amber-400">Why this hurts you: </span>
                  {selectedRisk.whyThisHurtsYou}
                </div>
              )}

              {/* Before / After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-red-900/30 bg-[#0a0a0a] flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-900/20 bg-red-950/10 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-400">Client's Version</span>
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed text-slate-400 flex-1">
                    {selectedRisk.explanation || selectedRisk.title || "No clause excerpt available."}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-[#0a0a0a] flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-300">Protected Version</span>
                    <ArrowRight className="h-3 w-3 text-slate-600 ml-auto" />
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed text-slate-300 flex-1">
                    {selectedRisk.fixes?.rewrittenClause || "No replacement clause available for this risk."}
                  </div>
                </div>
              </div>

              {/* Copy actions */}
              {selectedRisk.fixes?.rewrittenClause && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { void navigator.clipboard.writeText(selectedRisk.fixes?.rewrittenClause ?? ""); }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700"
                  >
                    Copy protected clause
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
