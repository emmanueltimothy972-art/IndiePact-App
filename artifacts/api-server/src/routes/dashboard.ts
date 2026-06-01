import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const RiskTrendsQuerySchema = z.object({
  userId: z.string().min(1).optional(),
  days: z.coerce.number().int().positive().default(30),
});

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const { data, error } = await requireSupabase()
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    req.log.error({ error }, "Failed to fetch dashboard summary");
    return res.status(500).json({ error: "Failed to fetch summary" });
  }

  const scans = (data ?? []) as Array<Record<string, unknown>>;
  const totalScans = scans.length;

  // revenue_at_risk_max is the money-at-risk figure persisted per scan
  const totalMoneyProtected = scans.reduce(
    (sum, s) => sum + (Number(s["revenue_at_risk_max"]) || 0),
    0
  );

  const averageProtectionScore =
    totalScans > 0
      ? scans.reduce((sum, s) => sum + (Number(s["protection_score"]) || 0), 0) / totalScans
      : 0;

  // Risks are stored in the result JSONB column
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  for (const scan of scans) {
    const result = (scan["result"] as Record<string, unknown>) ?? {};
    const risks = (result["risks"] as Array<Record<string, unknown>>) ?? [];
    for (const r of risks) {
      const sev = r["severity"] as string;
      if (sev === "High") highRiskCount++;
      else if (sev === "Medium") mediumRiskCount++;
      else lowRiskCount++;
    }
  }

  const recentScans = scans.slice(0, 5).map(mapScanRow);

  return res.json({
    totalScans,
    totalMoneyProtected,
    averageProtectionScore: Math.round(averageProtectionScore),
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    recentScans,
  });
});

router.get("/dashboard/risk-trends", requireAuth, async (req, res) => {
  const parse = RiskTrendsQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const userId = req.userId!;
  const { days } = parse.data;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await requireSupabase()
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    req.log.error({ error }, "Failed to fetch risk trends");
    return res.status(500).json({ error: "Failed to fetch trends" });
  }

  const scans = (data ?? []) as Array<Record<string, unknown>>;
  const trendMap: Record<string, Record<string, number>> = {};

  for (const scan of scans) {
    const date = new Date(scan["created_at"] as string).toISOString().slice(0, 10);
    if (!trendMap[date]) {
      trendMap[date] = {
        scopeCreep: 0, paymentDelay: 0, ipOwnership: 0,
        liability: 0, termination: 0, revisionAbuse: 0, vagueDeliverables: 0,
      };
    }
    const result = (scan["result"] as Record<string, unknown>) ?? {};
    const risks = (result["risks"] as Array<Record<string, unknown>>) ?? [];
    for (const risk of risks) {
      const cat = risk["category"] as string;
      if (cat && trendMap[date][cat] !== undefined) {
        trendMap[date][cat]++;
      }
    }
  }

  const trends = Object.entries(trendMap).map(([date, cats]) => ({ date, ...cats }));
  return res.json({ trends });
});

type DbRow = Record<string, unknown>;

function mapScanRow(row: DbRow) {
  const result = (row["result"] as Record<string, unknown>) ?? {};
  const risks = (result["risks"] as unknown[]) ?? [];
  const protectionScore = Number(row["protection_score"]) || Number(result["protectionScore"]) || 0;
  const revenueAtRiskMin = Number(row["revenue_at_risk_min"]) || Number(result["revenueAtRiskMin"]) || 0;
  const revenueAtRiskMax = Number(row["revenue_at_risk_max"]) || Number(result["revenueAtRiskMax"]) || 0;
  const riskCount = Number(row["risk_count"]) || risks.length;

  return {
    id: row["id"] as string,
    userId: row["user_id"] as string,
    contractName: (row["contract_name"] as string) ?? "",
    contractText: (row["contract_text"] as string) ?? "",
    result: {
      moneyImpactSummary: (result["moneyImpactSummary"] as string) ?? `${riskCount} risk(s) detected.`,
      revenueAtRiskMin,
      revenueAtRiskMax,
      protectionScore,
      risks,
      nextStep: (result["nextStep"] as string) ?? "Review all flagged clauses before signing.",
      rawExtractedClauses: (result["rawExtractedClauses"] as string[]) ?? [],
    },
    createdAt: row["created_at"] as string,
    protectionScore,
    revenueAtRiskMin,
    revenueAtRiskMax,
    riskCount,
  };
}

export default router;
