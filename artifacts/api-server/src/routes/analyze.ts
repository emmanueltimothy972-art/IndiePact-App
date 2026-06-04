import { Router } from "express";
import { z } from "zod";
import { extractRiskyClauses, truncateForAI } from "../lib/prefilter.js";
import { analyzeContractClauses, buildFallbackResult } from "../lib/openai.js";
import { hashContractText } from "../lib/contract-hash.js";
import { requireSupabase } from "../lib/supabase.js";
import { checkScanGate, incrementScanUsage } from "../lib/scanTracking.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeRateLimiter } from "../middleware/rateLimiter.js";
import { analysisCache } from "../lib/inflightCache.js";

const router = Router();

const AnalyzeBodySchema = z.object({
  contractText: z.string().min(50, "Contract text must be at least 50 characters"),
  // userId in body is accepted for schema compatibility but IGNORED.
  // The authoritative userId always comes from the verified JWT via requireAuth.
  userId: z.string().optional(),
  contractName: z.string().optional(),
});

router.post("/analyze", analyzeRateLimiter, requireAuth, async (req, res) => {
  const startMs = Date.now();

  const parse = AnalyzeBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { contractText } = parse.data;
  // userId is always taken from the verified JWT — never from the request body.
  const userId = req.userId!;

  // ── 1. Scan gate ─────────────────────────────────────────────────────────
  // Authoritative check: reads profiles.scans_used. Monthly auto-reset if
  // subscriptions.period_start is older than 30 days.
  try {
    const gate = await checkScanGate(userId, req.userEmail);

    req.log.info(
      {
        userId,
        plan: gate.plan,
        scansUsed: gate.scansUsed,
        remaining: gate.remaining,
        event: "scan_gate_check",
      },
      "Scan gate check",
    );

    if (!gate.allowed) {
      req.log.info(
        { userId, event: "scan_gate_blocked", plan: gate.plan, scansUsed: gate.scansUsed },
        "Scan gate blocked — quota exhausted",
      );
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
    req.log.warn({ err, event: "scan_gate_error" }, "Scan gate check failed — allowing request");
  }

  // ── 2. Hash the contract text ─────────────────────────────────────────────
  // Normalization: trim → lowercase → collapse all whitespace runs to one space.
  // Identical to the PostgreSQL expression used in the backfill migration:
  //   lower(btrim(regexp_replace(contract_text, '\s+', ' ', 'g')))::bytea → sha256 → hex
  const contractHash = hashContractText(contractText);

  // ── 3. Deduplication: DB lookup ───────────────────────────────────────────
  // Checks this user's own scan history only. The WHERE clause always includes
  // user_id so one user can never see another's result. Non-fatal on DB error.
  try {
    const { data: cachedScan } = await requireSupabase()
      .from("scans")
      .select("id, result, contract_name")
      .eq("user_id", userId)
      .eq("contract_hash", contractHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cachedScan?.result) {
      req.log.info(
        {
          userId,
          event: "dedup_hit_db",
          contractHash: contractHash.slice(0, 12),
          scanId: cachedScan.id,
          latencyMs: Date.now() - startMs,
        },
        "Dedup hit (DB) — no OpenAI call, quota protected",
      );

      // Touch last_opened_at — fire-and-forget, never blocks the response.
      // Silently ignored if the column doesn't exist yet (pre-migration).
      void Promise.resolve(
        requireSupabase()
          .from("scans")
          .update({ last_opened_at: new Date().toISOString() })
          .eq("id", cachedScan.id),
      ).catch(() => {});

      return res.json({
        ...(cachedScan.result as Record<string, unknown>),
        _cached: true,
        _cachedScanId: cachedScan.id as string,
        _cachedContractName: cachedScan.contract_name as string,
      });
    }
  } catch {
    // Cache miss or DB unavailable — continue to AI analysis
  }

  // ── 4. Deduplication: in-flight lookup ────────────────────────────────────
  // Prevents duplicate OpenAI calls when the SAME user submits the SAME contract
  // twice before the first request's DB INSERT completes. The key is always
  // namespaced by userId — different users never share in-flight results.
  //
  // On serverless platforms each cold-start instance has isolated module memory,
  // so this only deduplicates within the same running instance. The DB UNIQUE
  // constraint + ON CONFLICT in scans.ts handles cross-instance races.
  const inflightKey = `${userId}:${contractHash}`;
  const inflightPromise = analysisCache.get(inflightKey);

  if (inflightPromise) {
    req.log.info(
      {
        userId,
        event: "dedup_hit_inflight",
        latencyMs: Date.now() - startMs,
      },
      "Dedup hit (in-flight) — awaiting existing AI call, no duplicate OpenAI spend",
    );
    try {
      const result = await inflightPromise;
      // Return the result with _cached:true but no _cachedScanId since the
      // original request's save may not have completed yet. The frontend
      // will fall back to inline display without calling saveScan again.
      return res.json({ ...result, _cached: true });
    } catch {
      // The original AI call failed — fall through to make an independent call.
      req.log.warn(
        { userId, event: "dedup_inflight_fallthrough" },
        "Inflight promise rejected — proceeding with independent AI call",
      );
    }
  }

  // ── 5. AI Analysis ────────────────────────────────────────────────────────
  // Create a deferred Promise and store it in the in-flight cache BEFORE
  // the async work begins. Any concurrent request hitting step 4 after this
  // point will await this promise instead of making its own AI call.

  let resolveInflight!: (r: Record<string, unknown>) => void;
  let rejectInflight!: (e: unknown) => void;
  const sharedPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveInflight = resolve;
    rejectInflight = reject;
  });
  analysisCache.set(inflightKey, sharedPromise);

  try {
    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);

    if (extractedClauses.length === 0) {
      // No risky clauses found — no AI call needed, no quota consumed.
      const zeroRiskResult = {
        moneyImpactSummary: "No significant risk indicators found in this contract.",
        revenueAtRiskMin: 0,
        revenueAtRiskMax: 0,
        protectionScore: 90,
        risks: [],
        nextStep: "This contract appears relatively safe. Review manually to confirm.",
        rawExtractedClauses: [],
        _contractHash: contractHash,
        _cached: false,
      };
      resolveInflight(zeroRiskResult);
      return res.json(zeroRiskResult);
    }

    const truncatedClauses = truncateForAI(extractedClauses);
    const clauseList = truncatedClauses.split("\n\n").filter(Boolean);

    req.log.info(
      { userId, clauseCount: clauseList.length, event: "ai_analysis_start" },
      "Starting AI analysis",
    );

    const result = await analyzeContractClauses(clauseList, foundCategories);

    req.log.info(
      {
        userId,
        riskCount: result.risks.length,
        protectionScore: result.protectionScore,
        event: "ai_analysis_complete",
        latencyMs: Date.now() - startMs,
      },
      "AI analysis complete",
    );

    const fullResult = {
      ...result,
      _contractHash: contractHash,
      _cached: false,
    } as unknown as Record<string, unknown>;

    // Resolve the shared promise — wakes up any concurrent requests waiting
    // in step 4. They receive the same result and return it to their clients.
    resolveInflight(fullResult);

    // Increment usage after confirmed AI success — fire-and-forget.
    // A tracking failure must never fail the scan response.
    // Superuser email is exempt from quota tracking.
    const isSuperuser =
      req.userEmail?.toLowerCase() === "emmanueltimothy972@gmail.com";
    if (!isSuperuser) {
      void incrementScanUsage(userId).catch((err) =>
        req.log.warn(
          { err, userId, event: "quota_increment_failed" },
          "Scan usage increment failed — non-fatal",
        ),
      );
    }

    return res.json(fullResult);
  } catch (err) {
    // Signal failure to any concurrent waiters — they will fall through and
    // make their own independent AI calls rather than receiving a failed result.
    rejectInflight(err);

    req.log.error(
      { err, event: "ai_analysis_failed", latencyMs: Date.now() - startMs },
      "AI analysis failed — using heuristic fallback. Quota NOT incremented.",
    );

    const { extractedClauses, foundCategories } = extractRiskyClauses(contractText);
    const fallback = buildFallbackResult(extractedClauses, foundCategories);

    return res.json({ ...fallback, _contractHash: contractHash, _cached: false });
  } finally {
    // Always clean up the in-flight entry. The InflightCache also has a 60s
    // hard timeout as a belt-and-suspenders safety net.
    analysisCache.delete(inflightKey);
  }
});

export default router;
