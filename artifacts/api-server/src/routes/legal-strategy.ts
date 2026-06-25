import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { runLegalStrategyAnalysis } from "../lib/openai.js";
import { getUserPlan, hasBackendFeature } from "../lib/userPlan.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { strategyCache } from "../lib/result-cache.js";

const router = Router();

const LegalStrategyBodySchema = z.object({
  scanId: z.string().min(1, "scanId is required"),
  userId: z.string().optional(),
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

router.post("/legal-strategy", requireAuth, async (req: Request, res: Response) => {
  const parse = LegalStrategyBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { scanId, contractData } = parse.data;
  const userId = req.userId!;

  // ── Plan gate: requires Business or above ─────────────────────────────────
  try {
    const { plan } = await getUserPlan(userId);
    if (!hasBackendFeature(plan, "LEGAL_STRATEGY")) {
      return res.status(403).json({
        error: "AI Legal Strategy requires a Business plan or above.",
        requiredPlan: "business",
        currentPlan: plan,
      });
    }
  } catch (err) {
    req.log.warn({ err }, "Could not verify plan for legal strategy — allowing request");
  }

  let risks: RiskItem[] = [];
  let protectionScore = 0;
  let moneyImpactSummary = "";

  // ── Path A: caller passed contractData directly ───────────────────────────
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
  // ── Path B: look up by scanId in DB ──────────────────────────────────────
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

  if (risks.length === 0) {
    return res.json(buildEmptyStrategyResponse());
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  // Legal strategy is deterministic: same scanId + same user → same output.
  // Cache for 30 minutes to eliminate repeat OpenAI calls when users revisit
  // the page or navigate back. Key is user-scoped to prevent cross-user leaks.
  //
  // contractData path uses a content hash of the risks array as key, since
  // there is no stable scanId.
  const cacheKey = scanId !== "__active__" && scanId
    ? `${userId}:${scanId}`
    : `${userId}:inline:${Buffer.from(JSON.stringify(risks)).toString("base64").slice(0, 32)}`;

  const cached = strategyCache.get(cacheKey);
  if (cached) {
    req.log.info({ userId, scanId, cacheKey, event: "strategy_cache_hit" },
      "Legal strategy cache hit — no OpenAI call");
    return res.json({ ...cached, _cached: true });
  }

  try {
    req.log.info({ userId, scanId, riskCount: risks.length }, "Running legal strategy analysis");
    const strategy = await runLegalStrategyAnalysis(risks, protectionScore, moneyImpactSummary);

    // Store in cache — fire-and-forget, never blocks the response.
    strategyCache.set(cacheKey, strategy);

    return res.json(strategy);
  } catch (err) {
    req.log.error({ err }, "Legal strategy analysis failed");
    return res.status(500).json({ error: "Strategy analysis failed. Please try again." });
  }
});

export default router;
