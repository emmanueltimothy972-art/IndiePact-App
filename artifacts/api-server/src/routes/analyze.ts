import { Router } from "express";
import { z } from "zod";
import {
  extractRiskyClauses,
  truncateForAI,
} from "../lib/prefilter.js";
import {
  analyzeContractClauses,
  buildFallbackResult,
} from "../lib/openai.js";

const router = Router();

const AnalyzeBodySchema = z.object({
  contractText: z.string().min(50, "Contract text must be at least 50 characters"),
  userId: z.string().min(1, "userId is required"),
  contractName: z.string().optional(),
});

router.post("/analyze", async (req, res) => {
  const parse = AnalyzeBodySchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parse.error.message,
    });
  }

  const { contractText, userId } = parse.data;

  try {
    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);

    if (extractedClauses.length === 0) {
      return res.json({
        moneyImpactSummary: "No significant risk indicators found in this contract.",
        revenueAtRiskMin: 0,
        revenueAtRiskMax: 0,
        protectionScore: 90,
        risks: [],
        nextStep: "This contract appears relatively safe. Review manually to confirm.",
        rawExtractedClauses: [],
      });
    }

    const truncatedClauses = truncateForAI(extractedClauses);
    const clauseList = truncatedClauses.split("\n\n").filter(Boolean);

    req.log.info({ userId, clauseCount: clauseList.length }, "Analyzing contract");

    const result = await analyzeContractClauses(clauseList, foundCategories);

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI analysis failed, using fallback");

    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);
    const fallback = buildFallbackResult(extractedClauses, foundCategories);

    return res.json(fallback);
  }
});

export default router;
