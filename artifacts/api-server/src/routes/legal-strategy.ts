import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { runLegalStrategyAnalysis } from "../lib/openai.js";

const router = Router();

const LegalStrategyBodySchema = z.object({
  // Accept any non-empty string — cached scans may have temp IDs, active scans use __active__
  scanId: z.string().min(1, "scanId is required"),
  userId: z.string().min(1, "userId is required"),
  // Optional: caller can pass the full result JSON instead of a DB scanId
  contractData: z.string().optional(),
});

type RiskItem = {
  title: string;
  severity: string;
  explanation: string;
  whyThisHurtsYou: string;
  category: string;
  fixes: { rewrittenClause: string; direct: string };
};

function buildEmptyStrategyResponse() {
  return {
    overallAssessment: "Based on our analysis, this contract appears to be relatively clean with minimal risk indicators. You are in a strong position to sign.",
    powerBalance: { score: 75, label: "Strong", explanation: "Few risks were identified, giving you strong negotiating position or a safe path to signing." },
    priorityRisks: [],
    negotiationOrder: [{ step: 1, action: "Request a brief review window before signing", rationale: "Even clean contracts benefit from a 24-hour review period", tactic: "Request" }],
    questionsToAsk: [
      "What is the timeline for project completion?",
      "Are there any penalties for delays on either side?",
      "How are disputes resolved?",
      "Is there a renewal clause?",
      "What constitutes acceptable delivery?",
    ],
    redFlags: [],
    recommendedMove: "You should review the contract once more for any definitions or schedules, then proceed to signing with confidence.",
    checklist: [
      { item: "Confirm project scope is clearly defined", priority: "High" },
      { item: "Verify payment timeline and method", priority: "High" },
      { item: "Check termination clause (notice period)", priority: "Medium" },
      { item: "Review intellectual property ownership", priority: "High" },
      { item: "Confirm any confidentiality requirements", priority: "Medium" },
      { item: "Set project milestones in writing", priority: "Low" },
      { item: "Save a signed copy securely", priority: "Low" },
    ],
  };
}

router.post("/legal-strategy", async (req, res) => {
  const parse = LegalStrategyBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { scanId, userId, contractData } = parse.data;

  let risks: RiskItem[] = [];
  let protectionScore = 0;
  let moneyImpactSummary = "";

  // ── Path A: caller passed contractData directly (active/cached scan, no DB needed) ──
  if (contractData) {
    try {
      const parsed = JSON.parse(contractData) as {
        risks?: RiskItem[];
        protectionScore?: number;
        moneyImpactSummary?: string;
      };
      risks = parsed.risks ?? [];
      protectionScore = parsed.protectionScore ?? 0;
      moneyImpactSummary = parsed.moneyImpactSummary ?? "";
    } catch {
      return res.status(400).json({ error: "Invalid contractData payload" });
    }
  }
  // ── Path B: look up by scanId in DB ──────────────────────────────────────────────
  else if (scanId !== "__active__") {
    const { data: scan, error: fetchError } = await requireSupabase()
      .from("scans")
      .select("id, contract_name, result, protection_score")
      .eq("id", scanId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !scan) {
      req.log.warn({ scanId, userId }, "Scan not found for legal strategy");
      return res.status(404).json({ error: "Scan not found. Please run a contract review first." });
    }

    const result = scan.result as {
      risks?: RiskItem[];
      moneyImpactSummary?: string;
      protectionScore?: number;
    };
    risks = result?.risks ?? [];
    protectionScore = Number(scan.protection_score) || result?.protectionScore || 0;
    moneyImpactSummary = result?.moneyImpactSummary ?? "";
  }

  // ── No risks found — return a positive assessment ─────────────────────────────────
  if (risks.length === 0) {
    return res.json(buildEmptyStrategyResponse());
  }

  try {
    req.log.info({ userId, scanId, riskCount: risks.length }, "Running legal strategy analysis");
    const strategy = await runLegalStrategyAnalysis(risks, protectionScore, moneyImpactSummary);
    return res.json(strategy);
  } catch (err) {
    req.log.error({ err }, "Legal strategy analysis failed");
    return res.status(500).json({ error: "Strategy analysis failed. Please try again." });
  }
});

export default router;
