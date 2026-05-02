import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

const router = Router();

const UserQuerySchema = z.object({ userId: z.string().min(1) });
const RiskTrendsQuerySchema = z.object({
  userId: z.string().min(1),
  days: z.coerce.number().int().positive().default(30),
});

router.get("/dashboard/summary", async (req, res) => {
  const parse = UserQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "userId is required" });
  }

  const { userId } = parse.data;

  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    req.log.error({ error }, "Failed to fetch dashboard summary");
    return res.status(500).json({ error: "Failed to fetch summary" });
  }

  const scans = data ?? [];
  const totalScans = scans.length;
  const totalMoneyProtected = scans.reduce(
    (sum: number, s: Record<string, unknown>) => sum + (Number(s["revenue_at_risk_max"]) || 0),
    0
  );
  const averageProtectionScore =
    totalScans > 0
      ? scans.reduce(
          (sum: number, s: Record<string, unknown>) => sum + (Number(s["protection_score"]) || 0),
          0
        ) / totalScans
      : 0;

  const allRisks: Array<Record<string, unknown>> = [];
  for (const scan of scans) {
    const result = scan["result"] as Record<string, unknown>;
    const risks = (result?.["risks"] ?? []) as Array<Record<string, unknown>>;
    allRisks.push(...risks);
  }

  const highRiskCount = allRisks.filter((r) => r["severity"] === "High").length;
  const mediumRiskCount = allRisks.filter((r) => r["severity"] === "Medium").length;
  const lowRiskCount = allRisks.filter((r) => r["severity"] === "Low").length;

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

router.get("/dashboard/risk-trends", async (req, res) => {
  const parse = RiskTrendsQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const { userId, days } = parse.data;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    req.log.error({ error }, "Failed to fetch risk trends");
    return res.status(500).json({ error: "Failed to fetch trends" });
  }

  const scans = data ?? [];

  const trendMap: Record<string, Record<string, number>> = {};

  for (const scan of scans) {
    const date = new Date(scan["created_at"] as string)
      .toISOString()
      .slice(0, 10);

    if (!trendMap[date]) {
      trendMap[date] = {
        scopeCreep: 0,
        paymentDelay: 0,
        ipOwnership: 0,
        liability: 0,
        termination: 0,
        revisionAbuse: 0,
        vagueDeliverables: 0,
      };
    }

    const result = scan["result"] as Record<string, unknown>;
    const risks = (result?.["risks"] ?? []) as Array<Record<string, unknown>>;

    for (const risk of risks) {
      const cat = risk["category"] as string;
      if (cat && trendMap[date][cat] !== undefined) {
        trendMap[date][cat]++;
      }
    }
  }

  const trends = Object.entries(trendMap).map(([date, cats]) => ({
    date,
    ...cats,
  }));

  return res.json({ trends });
});

function mapScanRow(row: Record<string, unknown>) {
  return {
    id: row["id"] as string,
    userId: row["user_id"] as string,
    contractName: row["contract_name"] as string,
    contractText: row["contract_text"] as string,
    result: row["result"] as Record<string, unknown>,
    createdAt: row["created_at"] as string,
    protectionScore: row["protection_score"] as number,
    revenueAtRiskMin: row["revenue_at_risk_min"] as number,
    revenueAtRiskMax: row["revenue_at_risk_max"] as number,
    riskCount: row["risk_count"] as number,
  };
}

export default router;
