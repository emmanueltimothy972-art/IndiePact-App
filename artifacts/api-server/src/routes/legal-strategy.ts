import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { runLegalStrategyAnalysis } from "../lib/openai.js";

const router = Router();

const LegalStrategyBodySchema = z.object({
  scanId: z.string().uuid("scanId must be a valid UUID"),
  userId: z.string().min(1, "userId is required"),
});

router.post("/legal-strategy", async (req, res) => {
  const parse = LegalStrategyBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { scanId, userId } = parse.data;

  const { data: scan, error: fetchError } = await requireSupabase()
    .from("scans")
    .select("id, contract_name, result")
    .eq("id", scanId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !scan) {
    req.log.warn({ scanId, userId }, "Scan not found for legal strategy");
    return res.status(404).json({ error: "Scan not found" });
  }

  const result = scan.result as {
    risks: Array<{ title: string; severity: string; explanation: string; whyThisHurtsYou: string; category: string; fixes: { rewrittenClause: string; direct: string } }>;
    moneyImpactSummary: string;
    protectionScore: number;
    revenueAtRiskMax: number;
    nextStep: string;
  };

  if (!result?.risks || result.risks.length === 0) {
    return res.json({
      overallAssessment: "Based on our analysis, this contract appears to be relatively clean with minimal risk indicators. You are in a strong position to sign.",
      powerBalance: { score: 75, label: "Strong", explanation: "Few risks were identified, giving you strong negotiating position or a safe path to signing." },
      priorityRisks: [],
      negotiationOrder: [{ step: 1, action: "Request a brief review window before signing", rationale: "Even clean contracts benefit from a 24-hour review period", tactic: "Request" }],
      questionsToAsk: ["What is the timeline for project completion?", "Are there any penalties for delays on either side?", "How are disputes resolved?", "Is there a renewal clause?", "What constitutes acceptable delivery?"],
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
    });
  }

  try {
    req.log.info({ userId, scanId, riskCount: result.risks.length }, "Running legal strategy analysis");
    const strategy = await runLegalStrategyAnalysis(result.risks, result.protectionScore, result.moneyImpactSummary);
    return res.json(strategy);
  } catch (err) {
    req.log.error({ err }, "Legal strategy analysis failed");
    return res.status(500).json({ error: "Strategy analysis failed. Please try again." });
  }
});

export default router;
