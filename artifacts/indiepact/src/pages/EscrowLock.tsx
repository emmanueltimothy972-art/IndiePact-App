import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/PageTransition";
import { useListScans, getListScansQueryKey } from "@workspace/api-client-react";
import { Lock, CheckSquare, Square, AlertTriangle, DollarSign, Loader2, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useScanContext } from "@/contexts/ScanContext";

interface Milestone {
  label: string;
  amount: string;
  trigger: string;
  stopWork: string;
  checked: boolean;
}

type RiskItem = {
  category: string;
  title: string;
  explanation: string;
  whyThisHurtsYou: string;
  fixes: { direct: string };
};

function deriveMilestones(risks: RiskItem[]): Milestone[] {
  const paymentRisks = risks.filter(
    (r) => r.category === "paymentDelay" || r.category === "termination" || r.category === "scopeCreep"
  );

  if (paymentRisks.length === 0) {
    return [
      {
        label: "Kickoff Payment",
        amount: "Verify in contract",
        trigger: "Due on contract execution",
        stopWork: "If payment is not received within 5 business days of signing, you may pause onboarding.",
        checked: false,
      },
      {
        label: "Mid-Project Milestone",
        amount: "Verify in contract",
        trigger: "Due at 50% deliverable completion",
        stopWork: "If payment is 7 days overdue, you may pause all deliverables until cleared.",
        checked: false,
      },
      {
        label: "Final Delivery Payment",
        amount: "Verify in contract",
        trigger: "Due on final delivery",
        stopWork: "Retain all source files and final assets until full payment is confirmed in writing.",
        checked: false,
      },
    ];
  }

  return paymentRisks.map((risk, idx): Milestone => ({
    label: risk.title || `Payment Checkpoint ${idx + 1}`,
    amount: "See contract §Payment",
    trigger: risk.explanation,
    stopWork: risk.whyThisHurtsYou
      ? `Stop-Work Trigger: ${risk.whyThisHurtsYou}`
      : "If this clause is exercised, pause all deliverables until resolved in writing.",
    checked: false,
  }));
}

export default function EscrowLock() {
  const { userId } = useAuth();
  const { activeScan, cachedScans } = useScanContext();
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);

  const { data: apiData, isLoading: apiLoading } = useListScans(
    { userId, limit: 1, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId, limit: 1, offset: 0 }), retry: 1 } }
  );

  // Priority: activeScan → latest cachedScan → latest API scan
  const resolvedScan = useMemo(() => {
    if (activeScan) {
      return {
        contractName: activeScan.contractName,
        result: activeScan.result,
        revenueAtRiskMax: activeScan.result.revenueAtRiskMax ?? 0,
      };
    }
    if (cachedScans.length > 0) {
      const s = cachedScans[0];
      return {
        contractName: s.contractName,
        result: s.result,
        revenueAtRiskMax: s.revenueAtRiskMax ?? 0,
      };
    }
    const apiScan = apiData?.scans?.[0];
    if (apiScan) {
      return {
        contractName: apiScan.contractName,
        result: apiScan.result,
        revenueAtRiskMax: apiScan.revenueAtRiskMax ?? 0,
      };
    }
    return null;
  }, [activeScan, cachedScans, apiData]);

  const isLoading = apiLoading && !activeScan && cachedScans.length === 0;

  const risks = (resolvedScan?.result?.risks ?? []) as RiskItem[];
  const baseMilestones = useMemo(() => deriveMilestones(risks), [risks]);
  const displayed: Milestone[] = milestones ?? baseMilestones;

  const toggle = (idx: number) => {
    const base = milestones ?? baseMilestones;
    setMilestones(base.map((m, i) => i === idx ? { ...m, checked: !m.checked } : m));
  };

  const completedCount = displayed.filter((m) => m.checked).length;
  const riskAmount = resolvedScan?.revenueAtRiskMax
    ? `$${resolvedScan.revenueAtRiskMax.toLocaleString()}`
    : null;

  return (
    <PageTransition className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Lock className="text-[#D4AF37] h-8 w-8" />
            Payment Lock
          </h1>
          <p className="text-muted-foreground mt-2">
            Your financial bodyguard. Track milestones, know your stop-work triggers, and never let a payment slip.
          </p>
          {resolvedScan && (
            <p className="text-slate-500 text-sm mt-1 font-mono">
              Based on: <span className="text-slate-300">{resolvedScan.contractName}</span>
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-primary h-8 w-8" />
        </div>
      ) : !resolvedScan ? (
        <div className="border border-border rounded-xl bg-card p-12 text-center space-y-4">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No Contract Reviewed Yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Run a contract review first to generate your personalized Payment Lock Milestone Tracker.
          </p>
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <LinkIcon className="h-4 w-4" />
            Review a Contract
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {riskAmount && (
            <div className="border border-[#D4AF37]/40 bg-[#D4AF37]/5 rounded-xl p-5 flex items-center gap-5">
              <div className="h-12 w-12 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                <DollarSign className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                  Capital at Stake
                </div>
                <div className="text-3xl font-bold font-mono text-[#D4AF37]">{riskAmount}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm text-muted-foreground mb-0.5">Milestones Cleared</div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {completedCount}/{displayed.length}
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold mb-1">Milestone Tracker</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Check off each milestone as it's completed. Stop-work triggers fire automatically if a checkpoint is missed.
            </p>

            <div className="space-y-4">
              {displayed.map((milestone, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl bg-card overflow-hidden transition-all ${
                    milestone.checked ? "border-primary/40 opacity-70" : "border-border"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggle(idx)}
                        className="mt-0.5 shrink-0 text-primary hover:opacity-80 transition-opacity"
                        aria-label={milestone.checked ? "Mark incomplete" : "Mark complete"}
                      >
                        {milestone.checked
                          ? <CheckSquare className="h-6 w-6" />
                          : <Square className="h-6 w-6 text-muted-foreground" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <h3 className={`font-semibold text-base leading-tight ${milestone.checked ? "line-through text-muted-foreground" : ""}`}>
                            {milestone.label}
                          </h3>
                          <span className="font-mono text-sm font-bold text-[#D4AF37] shrink-0">
                            {milestone.amount}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                          {milestone.trigger}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!milestone.checked && (
                    <div className="border-t border-destructive/20 bg-destructive/5 px-5 py-3 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive leading-relaxed font-medium">
                        {milestone.stopWork}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card p-6">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#D4AF37]" />
              Stop-Work Protocol
            </h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Send a written notice via email the moment a payment deadline passes.</li>
              <li>State clearly: "Pursuant to our agreement, all work is paused until payment is received."</li>
              <li>Do not deliver any final files, source assets, or passwords until cleared.</li>
              <li>If unresolved in 14 days, engage a collections service or file a small claims action.</li>
            </ol>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
