import { Router } from "express";
import { z } from "zod";
import { extractRiskyClauses, truncateForAI } from "../lib/prefilter.js";
import { analyzeContractClauses, buildFallbackResult } from "../lib/openai.js";
import { hashContractText } from "../lib/contract-hash.js";
import { requireSupabase } from "../lib/supabase.js";

const router = Router();

const AnalyzeBodySchema = z.object({
  contractText: z.string().min(50, "Contract text must be at least 50 characters"),
  userId: z.string().min(1, "userId is required"),
  contractName: z.string().optional(),
});

router.post("/analyze", async (req, res) => {
  const parse = AnalyzeBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { contractText, userId } = parse.data;

  // ── Deduplication check ──────────────────────────────────────────────────────
  // Hash the normalized contract text and look for an existing scan for this user.
  // If found, return the stored result instantly — no OpenAI call required.
  const contractHash = hashContractText(contractText);

  try {
    const { data: cachedScan } = await requireSupabase()
      .from("scans")
      .select("result, contract_name")
      .eq("user_id", userId)
      .eq("contract_hash", contractHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cachedScan?.result) {
      req.log.info({ userId, contractHash: contractHash.slice(0, 12) }, "Cache hit — returning stored result");
      return res.json({ ...cachedScan.result, _cached: true });
    }
  } catch {
    // Cache miss or DB unavailable — continue to AI analysis below
  }

  // ── AI Analysis ──────────────────────────────────────────────────────────────
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
        _cached: false,
      });
    }

    const truncatedClauses = truncateForAI(extractedClauses);
    const clauseList = truncatedClauses.split("\n\n").filter(Boolean);

    req.log.info({ userId, clauseCount: clauseList.length }, "Analyzing contract — no cache hit");

    const result = await analyzeContractClauses(clauseList, foundCategories);

    // Attach hash to result so the save route can store it without re-computing
    return res.json({ ...result, _contractHash: contractHash, _cached: false });
  } catch (err) {
    req.log.error({ err }, "AI analysis failed, using fallback");

    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);
    const fallback = buildFallbackResult(extractedClauses, foundCategories);

    return res.json({ ...fallback, _contractHash: contractHash, _cached: false });
  }
});

export default router;
