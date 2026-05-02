import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

const router = Router();

const ListScansQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const SaveScanBodySchema = z.object({
  userId: z.string().min(1),
  contractName: z.string().min(1),
  contractText: z.string(),
  result: z.object({
    moneyImpactSummary: z.string(),
    revenueAtRiskMin: z.number(),
    revenueAtRiskMax: z.number(),
    protectionScore: z.number(),
    risks: z.array(z.any()),
    nextStep: z.string(),
    rawExtractedClauses: z.array(z.string()),
  }),
});

const GetScanParamsSchema = z.object({ scanId: z.string() });
const GetScanQuerySchema = z.object({ userId: z.string().min(1) });

router.get("/scans", async (req, res) => {
  const parse = ListScansQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid query", details: parse.error.message });
  }

  const { userId, limit, offset } = parse.data;

  const { data, error, count } = await supabase
    .from("scans")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    req.log.error({ error }, "Failed to list scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }

  const scans = (data ?? []).map(mapScanRow);
  return res.json({ scans, total: count ?? 0 });
});

router.post("/scans", async (req, res) => {
  const parse = SaveScanBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { userId, contractName, contractText, result } = parse.data;

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      client_name: contractName,
      contract_text: contractText,
      risks_json: result.risks,
      fixes_json: result.rawExtractedClauses,
      protection_score: Math.round(result.protectionScore),
      leverage_score: Math.round(result.protectionScore),
      money_risk: result.revenueAtRiskMax,
    })
    .select()
    .single();

  if (error) {
    req.log.error({ error }, "Failed to save scan");
    return res.status(500).json({ error: "Failed to save scan" });
  }

  return res.status(201).json(mapScanRow(data, result));
});

router.get("/scans/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Scan not found" });
  }

  return res.json(mapScanRow(data));
});

router.delete("/scans/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { error } = await supabase
    .from("scans")
    .delete()
    .eq("id", scanId)
    .eq("user_id", userId);

  if (error) {
    req.log.error({ error }, "Failed to delete scan");
    return res.status(500).json({ error: "Failed to delete scan" });
  }

  return res.json({ success: true });
});

router.get("/report/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const scan = mapScanRow(data);
  const report = generateReportText(scan);
  const base64 = Buffer.from(report).toString("base64");
  const filename = `IndiePact-Report-${scan.contractName.replace(/\s+/g, "-")}.txt`;

  return res.json({ reportBase64: base64, filename });
});

type DbRow = Record<string, unknown>;

function mapScanRow(row: DbRow, liveResult?: Record<string, unknown>) {
  const risks = (row["risks_json"] as unknown[]) ?? [];
  const protectionScore = Number(row["protection_score"]) || 0;
  const moneyRisk = Number(row["money_risk"]) || 0;

  const result = liveResult ?? {
    moneyImpactSummary: `${risks.length} risk(s) detected. Revenue exposure estimated.`,
    revenueAtRiskMin: Math.round(moneyRisk * 0.5),
    revenueAtRiskMax: moneyRisk,
    protectionScore,
    risks,
    nextStep: "Review all flagged clauses before signing.",
    rawExtractedClauses: (row["fixes_json"] as string[]) ?? [],
  };

  return {
    id: row["id"] as string,
    userId: row["user_id"] as string,
    contractName: (row["client_name"] as string) ?? "",
    contractText: (row["contract_text"] as string) ?? "",
    result,
    createdAt: row["created_at"] as string,
    protectionScore,
    revenueAtRiskMin: Math.round(moneyRisk * 0.5),
    revenueAtRiskMax: moneyRisk,
    riskCount: risks.length,
  };
}

function generateReportText(scan: ReturnType<typeof mapScanRow>): string {
  const result = scan.result as Record<string, unknown>;
  const risks = (result["risks"] as Array<Record<string, unknown>>) ?? [];

  const lines = [
    "INDIEPACT AI — REVENUE PROTECTION REPORT",
    "==========================================",
    "",
    `Contract: ${scan.contractName}`,
    `Analysis Date: ${new Date(scan.createdAt).toLocaleDateString()}`,
    `Protection Score: ${scan.protectionScore}/100`,
    `Revenue at Risk: $${scan.revenueAtRiskMin.toLocaleString()} – $${scan.revenueAtRiskMax.toLocaleString()}`,
    "",
    "FINANCIAL IMPACT SUMMARY",
    "------------------------",
    String(result["moneyImpactSummary"] ?? ""),
    "",
    "DETECTED RISKS",
    "--------------",
  ];

  for (const risk of risks) {
    const fixes = (risk["fixes"] ?? {}) as Record<string, string>;
    lines.push("");
    lines.push(`[${risk["severity"]}] ${risk["title"]}`);
    lines.push(`Category: ${risk["category"]}`);
    lines.push(`Explanation: ${risk["explanation"]}`);
    lines.push(`Why This Hurts You: ${risk["whyThisHurtsYou"]}`);
    lines.push("");
    lines.push("Suggested Rewrite:");
    lines.push(fixes["rewrittenClause"] ?? "");
    lines.push("");
    lines.push("Negotiation Rebuttals:");
    lines.push(`  Direct: ${fixes["direct"] ?? ""}`);
    lines.push(`  Diplomatic: ${fixes["diplomatic"] ?? ""}`);
    lines.push(`  Legal: ${fixes["legal"] ?? ""}`);
    lines.push("---");
  }

  lines.push("");
  lines.push("RECOMMENDED NEXT STEP");
  lines.push("---------------------");
  lines.push(String(result["nextStep"] ?? ""));
  lines.push("");
  lines.push("Generated by IndiePact AI — Your Revenue Protection OS");

  return lines.join("\n");
}

export default router;
