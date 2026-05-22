import { Router } from "express";
import { z } from "zod";
import { extractRiskyClauses, truncateForAI } from "../lib/prefilter.js";
import { analyzeContractClauses, buildFallbackResult } from "../lib/openai.js";
import { hashContractText } from "../lib/contract-hash.js";
import { requireSupabase } from "../lib/supabase.js";
import { getUserPlan } from "../lib/userPlan.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const AnalyzeBodySchema = z.object({
  contractText: z.string().min(50, "Contract text must be at least 50 characters"),
  userId: z.string().optional(),
  contractName: z.string().optional(),
});

router.post("/analyze", analyzeRateLimiter, requireAuth, async (req, res) => {
  const parse = AnalyzeBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { contractText } = parse.data;
  const userId = req.userId!;

  // ── Subscription gate ─────────────────────────────────────────────────────
  // Read from the subscriptions table (single source of truth).
  try {
    const { plan, scansUsed, scansLimit, periodExpired } = await getUserPlan(userId);

    req.log.info({ userId, plan, scansUsed, scansLimit, periodExpired }, "Subscription gate check");

    if (scansUsed >= scansLimit) {
      return res.status(403).json({
        error: "You have reached your scan limit for this billing period. Please upgrade to continue.",
        plan,
        scansUsed,
        scansLimit,
      });
    }
  } catch (err) {
    req.log.warn({ err }, "Could not check subscription gate — allowing request");
  }

  // ── Deduplication check ───────────────────────────────────────────────────
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

  // ── AI Analysis ───────────────────────────────────────────────────────────
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

    return res.json({ ...result, _contractHash: contractHash, _cached: false });
  } catch (err) {
    req.log.error({ err }, "AI analysis failed, using fallback");

    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);
    const fallback = buildFallbackResult(extractedClauses, foundCategories);

    return res.json({ ...fallback, _contractHash: contractHash, _cached: false });
  }
});

export default router;
