import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useListScans, getListScansQueryKey } from "@workspace/api-client-react";
import { useScanContext } from "@/contexts/ScanContext";
import {
  Brain, Zap, Scale, AlertTriangle, CheckCircle2, ChevronRight,
  ArrowRight, Loader2, MessageSquare, FileSearch, Star,
  Shield, Clock, Target, HelpCircle,
} from "lucide-react";

interface LegalStrategyResult {
  overallAssessment: string;
  powerBalance: { score: number; label: string; explanation: string };
  priorityRisks: Array<{ rank: number; title: string; urgency: string; impact: string; negotiationApproach: string }>;
  negotiationOrder: Array<{ step: number; action: string; rationale: string; tactic: string }>;
  questionsToAsk: string[];
  redFlags: Array<{ clause: string; interpretation: string; realWorldImpact: string }>;
  recommendedMove: string;
  checklist: Array<{ item: string; priority: string; completed?: boolean }>;
}

const TACTIC_COLORS: Record<string, string> = {
  Anchor: "bg-blue-950/40 border-blue-800/40 text-blue-400",
  Trade: "bg-purple-950/40 border-purple-800/40 text-purple-400",
  Reframe: "bg-teal-950/40 border-teal-800/40 text-teal-400",
  "Walk Away": "bg-red-950/40 border-red-800/40 text-red-400",
  Request: "bg-emerald-950/40 border-emerald-800/40 text-emerald-400",
};

const URGENCY_COLORS: Record<string, string> = {
  Immediate: "bg-red-950/40 border-red-800/40 text-red-400",
  High: "bg-amber-950/40 border-amber-800/40 text-amber-400",
  Moderate: "bg-emerald-950/40 border-emerald-800/40 text-emerald-400",
};

function PowerMeter({ score, label, explanation }: { score: number; label: string; explanation: string }) {
  const color = score >= 65 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const labelColor = score >= 65 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Scale className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-white">Your Negotiating Position</h3>
        </div>
        <span className={`text-xl font-bold font-mono ${labelColor}`}>{label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Unfavorable</span>
          <span>Balanced</span>
          <span>Strong</span>
        </div>
        <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600">0</span>
          <span className={`text-sm font-bold font-mono ${labelColor}`}>{score}/100</span>
          <span className="text-xs text-slate-600">100</span>
        </div>
      </div>

      <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800 pt-4">{explanation}</p>
    </div>
  );
}

function StrategyResults({ result, contractName }: { result: LegalStrategyResult; contractName: string }) {
  const [checklist, setChecklist] = useState(
    result.checklist.map((item) => ({ ...item, completed: false }))
  );

  const toggleCheck = (index: number) => {
    setChecklist((prev) => prev.map((item, i) => i === index ? { ...item, completed: !item.completed } : item));
  };

  const completedCount = checklist.filter((i) => i.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Contract name */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <FileSearch className="h-4 w-4" />
        <span>Strategy analysis for:</span>
        <span className="text-slate-300 font-medium">{contractName}</span>
      </div>

      {/* Overall Assessment */}
      <div
        className="rounded-2xl p-6 border border-emerald-900/30 space-y-3"
        style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(10,10,10,0.98) 80%)" }}
      >
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Strategic Assessment</h3>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">{result.overallAssessment}</p>
        <p className="text-xs text-slate-600 italic border-t border-slate-800/60 pt-3">
          This is AI-assisted strategy, not legal advice. Consult a qualified attorney for complex matters.
        </p>
      </div>

      {/* Power Balance */}
      <PowerMeter
        score={result.powerBalance.score}
        label={result.powerBalance.label}
        explanation={result.powerBalance.explanation}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Risks */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-red-400" />
            Priority Issues to Address
          </h3>
          {result.priorityRisks.length > 0 ? result.priorityRisks.map((risk) => (
            <motion.div
              key={risk.rank}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: risk.rank * 0.06 }}
              className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {risk.rank}
                  </div>
                  <span className="font-medium text-white text-sm leading-tight">{risk.title}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${URGENCY_COLORS[risk.urgency] || URGENCY_COLORS.Moderate}`}>
                  {risk.urgency}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-8">{risk.impact}</p>
              <div className="pl-8 pt-1 border-t border-slate-800/60">
                <p className="text-xs text-emerald-400/80 leading-relaxed">
                  <span className="font-semibold">Approach: </span>{risk.negotiationApproach}
                </p>
              </div>
            </motion.div>
          )) : (
            <div className="rounded-xl border border-slate-800 bg-[#0a0a0a] p-5 text-center text-slate-500 text-sm">
              No critical priority risks identified.
            </div>
          )}
        </div>

        {/* Negotiation Order */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-blue-400" />
            Negotiation Roadmap
          </h3>
          <div className="space-y-2">
            {result.negotiationOrder.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex gap-3 rounded-xl border border-slate-800 bg-[#0a0a0a] p-4"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className="h-7 w-7 rounded-full bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {step.step}
                  </div>
                  {i < result.negotiationOrder.length - 1 && (
                    <div className="w-px flex-1 bg-slate-800 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white text-sm leading-tight">{step.action}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${TACTIC_COLORS[step.tactic] || TACTIC_COLORS.Request}`}>
                      {step.tactic}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.rationale}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {result.redFlags.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Red Flags — Clauses That Could Hurt You Most
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.redFlags.map((flag, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-xl border border-red-900/30 bg-red-950/5 p-4 space-y-3"
              >
                <div className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-red-800/50 pl-3">
                  "{flag.clause}"
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-amber-300/80 leading-snug">
                    <span className="font-semibold text-amber-400">What it means: </span>{flag.interpretation}
                  </p>
                  <p className="text-xs text-red-300/70 leading-snug">
                    <span className="font-semibold text-red-400">Impact: </span>{flag.realWorldImpact}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Questions to Ask */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-400" />
          Questions to Ask Before Signing
        </h3>
        <ul className="space-y-2.5">
          {result.questionsToAsk.map((q, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed"
            >
              <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              {q}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Recommended Move */}
      <div
        className="rounded-2xl p-6 border border-emerald-500/20 space-y-3"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(10,10,10,0.98) 80%)",
          boxShadow: "0 0 32px rgba(16,185,129,0.06)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Zap className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-emerald-300">Your Recommended Next Move</h3>
          <span className="text-xs bg-emerald-950/60 border border-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
            Do This First
          </span>
        </div>
        <p className="text-slate-200 text-sm leading-relaxed">{result.recommendedMove}</p>
      </div>

      {/* Smart Checklist */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Pre-Signing Checklist
          </h3>
          <span className="text-xs text-slate-500">
            {completedCount}/{checklist.length} complete
          </span>
        </div>

        <div className="space-y-2">
          {checklist.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                item.completed
                  ? "bg-emerald-950/20 border border-emerald-900/30"
                  : "bg-slate-900/40 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                item.completed
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-slate-600"
              }`}>
                {item.completed && <CheckCircle2 className="h-3.5 w-3.5 text-black" />}
              </div>
              <span className={`text-sm flex-1 ${item.completed ? "line-through text-slate-600" : "text-slate-300"}`}>
                {item.item}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                item.priority === "High"
                  ? "bg-red-950/30 border-red-900/30 text-red-400"
                  : item.priority === "Medium"
                  ? "bg-amber-950/30 border-amber-900/30 text-amber-400"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}>
                {item.priority}
              </span>
            </button>
          ))}
        </div>

        {completedCount === checklist.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-emerald-950/30 border border-emerald-900/40 p-4 text-center"
          >
            <p className="text-emerald-400 font-semibold text-sm">
              ✓ All items complete — you're ready to negotiate or sign.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function LegalStrategy() {
  const { userId, isGuest } = useAuth();
  const { activeScan, cachedScans } = useScanContext();
  const [selectedScanId, setSelectedScanId] = useState("");
  const [result, setResult] = useState<LegalStrategyResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContractName, setSelectedContractName] = useState("");

  const { data: scansData, isLoading: scansLoading } = useListScans(
    { userId, limit: 20, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId, limit: 20, offset: 0 }), enabled: !isGuest, retry: 1 } }
  );

  const dbScans = scansData?.scans ?? [];

  // Merge DB scans with localStorage cache, deduplicating by ID
  const allScans = (() => {
    const dbIds = new Set(dbScans.map((s) => s.id));
    const uniqueCached = cachedScans.filter((s) => !dbIds.has(s.id));
    return [...dbScans, ...uniqueCached];
  })();

  const scans = allScans;

  // Auto-select active scan when navigating here fresh from a review
  useEffect(() => {
    if (!activeScan || selectedScanId) return;
    const match = allScans.find((s) => s.contractName === activeScan.contractName);
    if (match) {
      setSelectedScanId(match.id);
      setSelectedContractName(match.contractName);
    } else if (allScans.length === 0) {
      // activeScan exists but no DB/cache entry yet — use a special sentinel
      setSelectedScanId("__active__");
      setSelectedContractName(activeScan.contractName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScan, allScans.length]);

  const handleAnalyze = async () => {
    if (!selectedScanId) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const baseUrl = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

      // A scan is DB-persisted only if the server actually returned it
      const isDbPersisted = dbScans.some((s) => s.id === selectedScanId);
      const needsContractData = !isDbPersisted || selectedScanId === "__active__";

      const body: Record<string, string> = { scanId: selectedScanId, userId };

      if (needsContractData) {
        // Find result data from cache or active scan to bypass DB lookup
        const selectedScan = allScans.find((s) => s.id === selectedScanId);
        const resultSource = selectedScan?.result ?? activeScan?.result;
        if (!resultSource) {
          setError("Could not load scan data. Please re-run the contract review and try again.");
          setIsAnalyzing(false);
          return;
        }
        body.contractData = JSON.stringify(resultSource);
      }

      const res = await fetch(`${baseUrl}/api/legal-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || "Strategy analysis failed");
      }

      const data = await res.json() as LegalStrategyResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      {/* Page intro */}
      <div
        className="rounded-2xl border border-slate-800 p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(10,10,10,0.99) 70%)" }}
      >
        <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">AI Legal Strategy</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                    NEW
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Your AI legal strategy partner — not a replacement for a lawyer, but a smarter way to prepare</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mt-3 max-w-2xl">
              AI Legal Strategy analyzes your contract review results and builds a complete negotiation plan —
              risk priorities, power balance, negotiation order, questions to ask, and your recommended first move.
              All in plain English.
            </p>
            <p className="text-xs text-slate-600 mt-2 italic">
              Example: A founder uses AI Legal Strategy before an investor meeting to know exactly which clauses to challenge first.
            </p>
          </div>
          <div className="shrink-0 space-y-2">
            {[
              { icon: <Scale className="h-3.5 w-3.5" />, text: "Power balance analysis" },
              { icon: <Target className="h-3.5 w-3.5" />, text: "Risk priority ranking" },
              { icon: <MessageSquare className="h-3.5 w-3.5" />, text: "Negotiation roadmap" },
              { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Pre-signing checklist" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-600">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Gate */}
      <FeatureGate
        requires="auth"
        featureName="AI Legal Strategy"
        featureDescription="Sign in to build a complete legal strategy for any contract you've reviewed. Understand your negotiating position, risk priorities, and the exact questions to ask before signing."
      >
        <FeatureGate
          requires="pro"
          featureName="AI Legal Strategy"
          featureDescription="AI Legal Strategy is a Pro feature. Upgrade to Pro ($49.99/month) to unlock power balance analysis, negotiation roadmaps, and pre-signing checklists for every contract."
        >
          {/* Scan Selector */}
          {!result && (
            <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white mb-1">Select a contract to analyze</h2>
                <p className="text-slate-500 text-sm">
                  Choose a contract you've already reviewed. AI Legal Strategy will build a complete negotiation plan from it.
                </p>
              </div>

              {scansLoading && scans.length === 0 ? (
                <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your reviews...
                </div>
              ) : scans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <FileSearch className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium mb-1">No contracts reviewed yet</p>
                  <p className="text-slate-600 text-sm mb-5">Review a contract first, then come back here for AI Legal Strategy.</p>
                  <a
                    href="/scan"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
                  >
                    <FileSearch className="h-4 w-4" />
                    Review a Contract First
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                    {scans.map((scan) => (
                      <button
                        key={scan.id}
                        onClick={() => {
                          setSelectedScanId(scan.id);
                          setSelectedContractName(scan.contractName);
                        }}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                          selectedScanId === scan.id
                            ? "border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
                            : "border-slate-800 bg-[#0c0c0c] hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedScanId === scan.id
                              ? "bg-emerald-950/60 border border-emerald-900/50"
                              : "bg-slate-800"
                          }`}>
                            <Shield className={`h-4 w-4 ${selectedScanId === scan.id ? "text-emerald-400" : "text-slate-500"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white text-sm truncate">{scan.contractName}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className={`text-xs font-mono ${
                                scan.protectionScore >= 70 ? "text-emerald-500" : scan.protectionScore >= 45 ? "text-amber-500" : "text-red-500"
                              }`}>
                                Score: {scan.protectionScore}/100
                              </span>
                              <span className="text-xs text-slate-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(scan.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedScanId === scan.id && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleAnalyze}
                    disabled={!selectedScanId || isAnalyzing}
                    className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Building your strategy...</>
                    ) : (
                      <><Brain className="mr-2 h-4 w-4" />Generate AI Legal Strategy</>
                    )}
                  </Button>

                  {isAnalyzing && (
                    <div className="text-center space-y-1">
                      <p className="text-xs text-slate-500">Analyzing {selectedContractName}...</p>
                      <div className="flex justify-center gap-1">
                        {["Assessing power balance", "Ranking risks", "Building roadmap", "Drafting questions"].map((step, i) => (
                          <motion.span
                            key={step}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0.5] }}
                            transition={{ delay: i * 0.6, duration: 1.2, repeat: Infinity }}
                            className="text-[10px] text-emerald-600"
                          >
                            {step}{i < 3 ? " · " : ""}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-emerald-400" />
                    <span className="text-slate-300 font-medium">Strategy Ready</span>
                  </div>
                  <button
                    onClick={() => { setResult(null); setSelectedScanId(""); setSelectedContractName(""); }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                  >
                    Analyze another
                  </button>
                </div>
                <StrategyResults result={result} contractName={selectedContractName} />
              </div>
            )}
          </AnimatePresence>
        </FeatureGate>
      </FeatureGate>
    </PageTransition>
  );
}
