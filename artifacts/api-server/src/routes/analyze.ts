import { Router } from "express";
import { z } from "zod";
import { extractRiskyClauses, truncateForAI } from "../lib/prefilter.js";
import { analyzeContractClauses, buildFallbackResult } from "../lib/openai.js";
import { hashContractText } from "../lib/contract-hash.js";
import { requireSupabase } from "../lib/supabase.js";
import { checkScanGate, incrementScanUsage } from "../lib/scanTracking.js";
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

  // ── Scan gate ────────────────────────────────────────────────────────────
  // Read from profiles (authoritative scan counter) with cross-check against
  // subscriptions.period_start for automatic monthly reset.
  try {
    const gate = await checkScanGate(userId);

    req.log.info(
      { userId, plan: gate.plan, scansUsed: gate.scansUsed, remaining: gate.remaining },
      "Scan gate check",
    );

    if (!gate.allowed) {
      return res.status(403).json({
        error: gate.reason,
        plan: gate.plan,
        scansUsed: gate.scansUsed,
        scansLimit: gate.scansLimit,
        remaining: gate.remaining,
        upgradeUrl: "/pricing",
      });
    }
  } catch (err) {
    req.log.warn({ err }, "Scan gate check failed — allowing request");
  }

  // ── Deduplication check ───────────────────────────────────────────────────
  // Return cached result instantly when the user re-submits the same contract.
  // Cache hits do NOT count as a new scan — no increment.
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
    // Cache miss or DB unavailable — continue to AI analysis
  }

  // ── AI Analysis ───────────────────────────────────────────────────────────
  try {
    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);

    if (extractedClauses.length === 0) {
      // No risky clauses found — return a safe result without counting as a scan,
      // since no AI call was made.
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

    req.log.info({ userId, clauseCount: clauseList.length }, "Running AI analysis");

    const result = await analyzeContractClauses(clauseList, foundCategories);

    // ── Increment usage after confirmed AI success ────────────────────────
    // Fire-and-forget: a tracking failure must never fail the scan response.
    void incrementScanUsage(userId).catch((err) =>
      req.log.warn({ err, userId }, "Scan usage increment failed — non-fatal"),
    );

    return res.json({ ...result, _contractHash: contractHash, _cached: false });
  } catch (err) {
    // AI call failed — fall back to a heuristic result.
    // Do NOT increment usage: the user received no real AI response.
    req.log.error({ err }, "AI analysis failed, using fallback");

    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);
    const fallback = buildFallbackResult(extractedClauses, foundCategories);

    return res.json({ ...fallback, _contractHash: contractHash, _cached: false });
  }
});

export default router;
