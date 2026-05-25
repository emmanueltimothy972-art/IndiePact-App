import { PageTransition } from "@/components/PageTransition";
import { useListScans, getListScansQueryKey } from "@workspace/api-client-react";
import {
  Scale, Loader2, Brain, FileText,
  AlertTriangle, CheckCircle2, Shield, TrendingUp, TrendingDown,
  Clock, ChevronRight, Search, X, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useScanContext } from "@/contexts/ScanContext";
import { canAccessAIAttorney } from "@/lib/constants";
import { FeatureGate } from "@/components/FeatureGate";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";

type Risk = {
  title?: string;
  explanation?: string;
  category: string;
  severity: "Low" | "Medium" | "High";
  whyThisHurtsYou?: string;
  fixes?: { rewrittenClause?: string; direct?: string; diplomatic?: string; legal?: string };
};

type ScanEntry = {
  id: string;
  contractName: string;
  protectionScore: number;
  createdAt: string;
  result?: { risks?: Risk[]; protectionScore?: number } | null;
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

function severityStyles(severity: string): { badge: string; bar: string; row: string } {
  if (severity === "High") return {
    badge: "bg-red-950/40 border-red-800/40 text-red-400",
    bar: "bg-red-500",
    row: "border-red-900/20",
  };
  if (severity === "Medium") return {
    badge: "bg-amber-950/40 border-amber-800/40 text-amber-400",
    bar: "bg-amber-500",
    row: "border-amber-900/20",
  };
  return {
    badge: "bg-slate-800 border-slate-700 text-slate-400",
    bar: "bg-slate-500",
    row: "border-slate-800",
  };
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

export default function TheBar() {
  const { userId, userPlan } = useAuth();
  const { activeScan, cachedScans } = useScanContext();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [selectedRiskIdx, setSelectedRiskIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [clarityMode, setClarityMode] = useState(false);

  const { data, isLoading } = useListScans(
    { userId, limit: 20, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId, limit: 20, offset: 0 }), retry: 1 } }
  );

  const hasPaid = canAccessAIAttorney(userPlan);

  const dbScans = data?.scans ?? [];
  const dbIds = new Set(dbScans.map((s) => s.id));
  const uniqueCached = cachedScans.filter((s) => !dbIds.has(s.id));
  const allScans: ScanEntry[] = useMemo(() =>
    [...dbScans, ...uniqueCached].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, cachedScans]);

  useEffect(() => {
    if (selectedScanId) return;
    if (activeScan) {
      const match = allScans.find((s) => s.contractName === activeScan.contractName);
      if (match) { setSelectedScanId(match.id); return; }
    }
    if (allScans.length > 0) setSelectedScanId(allScans[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScan, allScans.length]);

  useEffect(() => {
    setSelectedRiskIdx(0);
    setSearchQuery("");
    setFilterSeverity("All");
  }, [selectedScanId]);

  const sourceScan = selectedScanId
    ? allScans.find((s) => s.id === selectedScanId) ?? null
    : null;

  const sourceResult = (() => {
    if (sourceScan && activeScan && sourceScan.contractName === activeScan.contractName) {
      return activeScan.result;
    }
    return sourceScan?.result ?? null;
  })();

  const liveRisks: Risk[] = (sourceResult?.risks as Risk[] | undefined) ?? [];
  const isUsingReal = liveRisks.length > 0;
  const risks: Risk[] = isUsingReal ? liveRisks : (hasPaid && allScans.length === 0 ? MOCK_RISKS : []);
  const isUsingMock = !isUsingReal && hasPaid && allScans.length === 0;

  const highCount = risks.filter((r) => r.severity === "High").length;
  const medCount = risks.filter((r) => r.severity === "Medium").length;

  const filteredRisks = useMemo(() => risks.filter((r) => {
    if (filterSeverity !== "All" && r.severity !== filterSeverity) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.explanation ?? "").toLowerCase().includes(q) ||
      (r.title ?? "").toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.whyThisHurtsYou ?? "").toLowerCase().includes(q)
    );
  }), [risks, filterSeverity, searchQuery]);

  const clampedIdx = Math.min(selectedRiskIdx, Math.max(0, filteredRisks.length - 1));
  const selectedRisk = filteredRisks[clampedIdx] ?? null;

  return (
    <PageTransition className="space-y-5 max-w-5xl mx-auto">
      <FeatureGate
        requires="pro"
        featureName="AI Attorney"
        featureDescription="AI Attorney is available on the Pro plan and above. Upgrade to get clause-by-clause risk scoring, priority rankings, and ready-to-use protective rewrites for every flagged clause."
      >
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
        </div>
      </div>

      {/* Mock data notice */}
      {isUsingMock && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-700/50 bg-[#0a0a0a] text-xs text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0" />
          Showing sample clause data — review a contract to populate with your real clause intelligence.
          <Link href="/scan" className="ml-auto text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors whitespace-nowrap">
            Review a contract
          </Link>
        </div>
      )}

      {isLoading && allScans.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-slate-600 h-6 w-6" />
        </div>
      ) : allScans.length === 0 && !isUsingMock ? (
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
        <div className="space-y-5">
          {/* ── Scan Selector ─────────────────────────────────────────── */}
          {allScans.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Select Contract
                </p>
                <p className="text-[10px] text-slate-700">
                  {allScans.length} review{allScans.length !== 1 ? "s" : ""} available
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {allScans.map((scan) => {
                  const isSelected = selectedScanId === scan.id;
                  const sc = scan.protectionScore ?? 0;
                  return (
                    <button
                      key={scan.id}
                      onClick={() => setSelectedScanId(scan.id)}
                      className={`flex-none flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-colors min-w-[180px] max-w-[220px] ${
                        isSelected
                          ? "border-slate-600 bg-slate-800"
                          : "border-slate-800 bg-[#0c0c0c] hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-white leading-snug line-clamp-2 flex-1">
                          {scan.contractName}
                        </p>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono font-bold ${scoreColor(sc)}`}>
                          {sc}/100
                        </span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(scan.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── No risk data for selected scan ──────────────────────── */}
          {allScans.length > 0 && !isUsingReal && !isUsingMock && (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <Shield className="h-8 w-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium mb-1">No risk data for this contract</p>
              <p className="text-slate-600 text-sm">
                This scan doesn't have detailed clause data. Try reviewing the contract again.
              </p>
            </div>
          )}

          {/* ── Main analytics ──────────────────────────────────────── */}
          {(isUsingReal || isUsingMock) && (
            <div className="space-y-5">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Total Clauses",
                    value: risks.length,
                    icon: <Scale className="h-4 w-4 text-slate-400" />,
                    sub: "flagged issues",
                    valueClass: "text-slate-200",
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
                    <p className={`text-2xl font-bold font-mono ${stat.valueClass}`}>
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-slate-600">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Search + Filter ──────────────────────────────────── */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedRiskIdx(0); }}
                    placeholder="Search clauses, categories, or keywords…"
                    className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-700 bg-[#0c0c0c] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setSelectedRiskIdx(0); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(["All", "High", "Medium", "Low"] as const).map((sev) => {
                    const active = filterSeverity === sev;
                    const cls = {
                      All:    active ? "bg-slate-700 text-white border-slate-600"         : "text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300",
                      High:   active ? "bg-red-950/50 text-red-300 border-red-800/50"     : "text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300",
                      Medium: active ? "bg-amber-950/50 text-amber-300 border-amber-800/50" : "text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300",
                      Low:    active ? "bg-slate-800 text-slate-200 border-slate-600"     : "text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300",
                    };
                    return (
                      <button
                        key={sev}
                        onClick={() => { setFilterSeverity(sev); setSelectedRiskIdx(0); }}
                        className={`h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${cls[sev]}`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Clause Risk Matrix ───────────────────────────────── */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <h2 className="font-semibold text-white text-sm">Clause Risk Matrix</h2>
                  <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
                    {filteredRisks.length === risks.length
                      ? `${risks.length} clause${risks.length !== 1 ? "s" : ""}`
                      : `${filteredRisks.length} of ${risks.length}`}
                  </span>
                </div>

                {filteredRisks.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Search className="h-5 w-5 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No clauses match your search.</p>
                    <button
                      onClick={() => { setSearchQuery(""); setFilterSeverity("All"); setSelectedRiskIdx(0); }}
                      className="mt-2 text-xs text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800">
                            {["Clause Excerpt", "Category", "Severity", "Score", "Recommended Rewrite", ""].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRisks.map((risk, idx) => {
                            const score = riskScore(risk.severity);
                            const sty = severityStyles(risk.severity);
                            const isSelected = clampedIdx === idx;
                            return (
                              <tr
                                key={idx}
                                onClick={() => setSelectedRiskIdx(idx)}
                                className={`cursor-pointer border-b border-slate-800/60 last:border-b-0 transition-colors ${isSelected ? "bg-slate-800/40" : "hover:bg-slate-900/50"}`}
                              >
                                <td className="px-4 py-4 align-top w-[28%]">
                                  <p className="font-mono text-xs text-slate-400 leading-relaxed">
                                    {risk.explanation || risk.title || "—"}
                                  </p>
                                </td>
                                <td className="px-4 py-4 align-top whitespace-nowrap">
                                  <span className="text-xs text-slate-400">{risk.category}</span>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sty.badge}`}>
                                    {risk.severity}
                                  </span>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="flex flex-col gap-1.5">
                                    <span className={`text-xs font-mono font-bold ${score < 35 ? "text-red-400" : score < 65 ? "text-amber-400" : "text-emerald-500"}`}>
                                      {score}
                                    </span>
                                    <div className="h-1 w-10 bg-slate-800 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${sty.bar}`} style={{ width: `${score}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top w-[28%]">
                                  <p className="font-mono text-[11px] text-slate-500 leading-relaxed">
                                    {risk.fixes?.rewrittenClause || "—"}
                                  </p>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => { e.stopPropagation(); setSelectedRiskIdx(idx); }}
                                      className="h-7 px-3 text-[11px] border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white whitespace-nowrap"
                                    >
                                      Review
                                    </Button>
                                    {risk.fixes?.rewrittenClause && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(risk.fixes?.rewrittenClause ?? ""); }}
                                        className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
                                        title="Copy rewrite"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile card list */}
                    <div className="md:hidden divide-y divide-slate-800">
                      {filteredRisks.map((risk, idx) => {
                        const score = riskScore(risk.severity);
                        const sty = severityStyles(risk.severity);
                        const isSelected = clampedIdx === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedRiskIdx(idx)}
                            className={`p-4 space-y-3 cursor-pointer transition-colors ${isSelected ? "bg-slate-800/40" : "hover:bg-slate-900/40"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sty.badge}`}>
                                {risk.severity}
                              </span>
                              <span className="text-[10px] text-slate-500">{risk.category}</span>
                            </div>
                            <p className="font-mono text-xs text-slate-400 leading-relaxed">
                              {risk.explanation || risk.title || "—"}
                            </p>
                            {risk.fixes?.rewrittenClause && (
                              <p className="font-mono text-[11px] text-slate-600 leading-relaxed border-l-2 border-slate-700 pl-3">
                                {risk.fixes.rewrittenClause}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-bold ${score < 35 ? "text-red-400" : score < 65 ? "text-amber-400" : "text-emerald-500"}`}>
                                  {score}
                                </span>
                                <div className="h-1 w-10 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${sty.bar}`} style={{ width: `${score}%` }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); setSelectedRiskIdx(idx); }}
                                  className="h-7 px-3 text-[11px] border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                >
                                  Review
                                </Button>
                                {risk.fixes?.rewrittenClause && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(risk.fixes?.rewrittenClause ?? ""); }}
                                    className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* ── Clause Deep-Dive ─────────────────────────────────── */}
              {selectedRisk && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 flex-wrap">
                    <TrendingDown className="h-4 w-4 text-slate-500" />
                    <h2 className="font-semibold text-white text-sm">
                      Clause Deep-Dive —{" "}
                      <span className="text-slate-400 font-normal">{selectedRisk.category}</span>
                    </h2>
                    <span className="text-[10px] text-slate-600">
                      {clampedIdx + 1} of {filteredRisks.length}
                    </span>
                    {/* Clarity Mode toggle */}
                    <button
                      onClick={() => setClarityMode((v) => !v)}
                      className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all ${
                        clarityMode
                          ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
                          : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Scale className="h-3 w-3" />
                      {clarityMode ? "Clarity ON" : "Clarity Mode"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedRiskIdx((i) => Math.max(0, i - 1))}
                        disabled={clampedIdx === 0}
                        className="h-6 w-6 rounded flex items-center justify-center border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-3 w-3 rotate-180" />
                      </button>
                      <button
                        onClick={() => setSelectedRiskIdx((i) => Math.min(filteredRisks.length - 1, i + 1))}
                        disabled={clampedIdx === filteredRisks.length - 1}
                        className="h-6 w-6 rounded flex items-center justify-center border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Clarity Mode: severity label banner */}
                  {clarityMode && (
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-semibold ${
                      selectedRisk.severity === "High"
                        ? "border-red-900/50 bg-red-950/20 text-red-300"
                        : selectedRisk.severity === "Medium"
                        ? "border-amber-900/40 bg-amber-950/10 text-amber-300"
                        : "border-emerald-900/30 bg-emerald-950/10 text-emerald-300"
                    }`}>
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Risk Level</span>
                      <span className="font-bold tracking-widest text-sm">
                        {selectedRisk.severity === "High" ? "⚠ DANGEROUS" : selectedRisk.severity === "Medium" ? "◉ WATCH" : "✓ SAFE"}
                      </span>
                      <span className="ml-auto text-[10px] font-normal opacity-70">
                        {selectedRisk.severity === "High"
                          ? "This clause poses immediate legal or financial risk."
                          : selectedRisk.severity === "Medium"
                          ? "Monitor and negotiate if possible."
                          : "Low exposure — verify the rewritten version matches your context."}
                      </span>
                    </div>
                  )}

                  {/* Why it hurts */}
                  {selectedRisk.whyThisHurtsYou && (
                    <div className="rounded-xl border border-amber-900/30 bg-[#0a0a0a] px-5 py-4 text-sm text-amber-300/80 leading-relaxed">
                      <span className="font-semibold text-amber-400">Why this hurts you: </span>
                      {selectedRisk.whyThisHurtsYou}
                    </div>
                  )}

                  {/* Clarity Mode: Negotiation Hint */}
                  {clarityMode && selectedRisk.fixes?.direct && (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-700/50 bg-[#0c0c0c] px-5 py-3.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Negotiation Hint</p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {selectedRisk.fixes.direct.split(".")[0]}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Before / After */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-red-900/30 bg-[#0a0a0a] flex flex-col">
                      <div className="px-4 py-3 border-b border-red-900/20 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        <span className="text-xs font-semibold text-red-400">Client's Version</span>
                      </div>
                      <div className="p-5 font-mono text-xs leading-relaxed text-slate-400">
                        {selectedRisk.explanation || selectedRisk.title || "No clause excerpt available."}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700/50 bg-[#0a0a0a] flex flex-col">
                      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-300">Protected Version</span>
                      </div>
                      <div className="p-5 font-mono text-xs leading-relaxed text-slate-300">
                        {selectedRisk.fixes?.rewrittenClause || "No replacement clause available for this risk."}
                      </div>
                    </div>
                  </div>

                  {/* Copy action */}
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
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </FeatureGate>
    </PageTransition>
  );
}
