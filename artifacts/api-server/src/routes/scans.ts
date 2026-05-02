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
      contract_name: contractName,
      contract_text: contractText,
      result,
      protection_score: result.protectionScore,
      revenue_at_risk_min: result.revenueAtRiskMin,
      revenue_at_risk_max: result.revenueAtRiskMax,
      risk_count: result.risks.length,
    })
    .select()
    .single();

  if (error) {
    req.log.error({ error }, "Failed to save scan");
    return res.status(500).json({ error: "Failed to save scan" });
  }

  return res.status(201).json(mapScanRow(data));
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
  const report = generateReportMarkdown(scan);

  const base64 = Buffer.from(report).toString("base64");
  const filename = `IndiePact-Report-${scan.contractName.replace(/\s+/g, "-")}.txt`;

  return res.json({ reportBase64: base64, filename });
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

function generateReportMarkdown(scan: ReturnType<typeof mapScanRow>): string {
  const result = scan.result as Record<string, unknown>;
  const risks = result["risks"] as Array<Record<string, unknown>>;

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
    String(result["moneyImpactSummary"]),
    "",
    "DETECTED RISKS",
    "--------------",
  ];

  for (const risk of risks ?? []) {
    const fixes = risk["fixes"] as Record<string, string>;
    lines.push("");
    lines.push(`[${risk["severity"]}] ${risk["title"]}`);
    lines.push(`Category: ${risk["category"]}`);
    lines.push(`Explanation: ${risk["explanation"]}`);
    lines.push(`Why This Hurts You: ${risk["whyThisHurtsYou"]}`);
    lines.push("");
    lines.push("Suggested Rewrite:");
    lines.push(fixes?.["rewrittenClause"] ?? "");
    lines.push("");
    lines.push("Negotiation Rebuttals:");
    lines.push(`  Direct: ${fixes?.["direct"] ?? ""}`);
    lines.push(`  Diplomatic: ${fixes?.["diplomatic"] ?? ""}`);
    lines.push(`  Legal: ${fixes?.["legal"] ?? ""}`);
    lines.push("---");
  }

  lines.push("");
  lines.push("RECOMMENDED NEXT STEP");
  lines.push("---------------------");
  lines.push(String(result["nextStep"]));
  lines.push("");
  lines.push("Generated by IndiePact AI — Your Revenue Protection OS");

  return lines.join("\n");
}

export default router;
