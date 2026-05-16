import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";

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

// ── List scans ──────────────────────────────────────────────────────────────

router.get("/scans", async (req, res) => {
  const parse = ListScansQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid query", details: parse.error.message });
  }

  const { userId, limit, offset } = parse.data;

  const { data, error, count } = await requireSupabase()
    .from("scans")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    req.log.error({ error }, "Failed to list scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }

  const scans = (data ?? []).map((row) => mapScanRow(row));
  return res.json({ scans, total: count ?? 0 });
});

// ── Save scan ───────────────────────────────────────────────────────────────

router.post("/scans", async (req, res) => {
  const parse = SaveScanBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { userId, contractName, contractText, result } = parse.data;

  const { data, error } = await requireSupabase()
    .from("scans")
    .insert({
      user_id: userId,
      contract_name: contractName,
      contract_text: contractText,
      result,
      protection_score: Math.round(result.protectionScore),
      revenue_at_risk_min: Math.round(result.revenueAtRiskMin),
      revenue_at_risk_max: Math.round(result.revenueAtRiskMax),
      risk_count: result.risks.length,
    })
    .select()
    .single();

  if (error) {
    req.log.error({ error }, "Failed to save scan");
    return res.status(500).json({ error: "Failed to save scan" });
  }

  void incrementScanUsage(userId);

  return res.status(201).json(mapScanRow(data, result));
});

// ── Get scan by ID ──────────────────────────────────────────────────────────

router.get("/scans/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { data, error } = await requireSupabase()
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

// ── Delete scan ─────────────────────────────────────────────────────────────

router.delete("/scans/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { error } = await requireSupabase()
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

// ── Report ──────────────────────────────────────────────────────────────────

router.get("/report/:scanId", async (req, res) => {
  const paramParse = GetScanParamsSchema.safeParse(req.params);
  const queryParse = GetScanQuerySchema.safeParse(req.query);

  if (!paramParse.success || !queryParse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { scanId } = paramParse.data;
  const { userId } = queryParse.data;

  const { data, error } = await requireSupabase()
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const scan = mapScanRow(data);
  const report = generateReportHtml(scan);
  const base64 = Buffer.from(report).toString("base64");
  const filename = `IndiePact-Forensic-Audit-${scan.contractName.replace(/\s+/g, "-")}.html`;

  return res.json({ reportBase64: base64, filename });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function incrementScanUsage(userId: string): Promise<void> {
  try {
    const db = requireSupabase();
    const { data: existing } = await db
      .from("subscriptions")
      .select("scans_used")
      .eq("user_id", userId)
      .single();

    if (existing) {
      await db
        .from("subscriptions")
        .update({
          scans_used: (Number(existing["scans_used"]) || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await db.from("subscriptions").insert({
        user_id: userId,
        plan: "free",
        scans_used: 1,
        period_start: new Date().toISOString(),
      });
    }
  } catch {
    // Non-critical — usage tracking failure never blocks scan response
  }
}

type DbRow = Record<string, unknown>;

function mapScanRow(row: DbRow, liveResult?: Record<string, unknown>) {
  // Prefer liveResult (fresh from AI), then stored result JSONB
  const storedResult = (row["result"] as Record<string, unknown>) ?? {};
  const resultSource = liveResult ?? storedResult;

  const risks = (resultSource["risks"] as unknown[]) ?? [];
  const protectionScore =
    Number(row["protection_score"]) || Number(resultSource["protectionScore"]) || 0;
  const revenueAtRiskMin =
    Number(row["revenue_at_risk_min"]) ?? Number(resultSource["revenueAtRiskMin"]) ?? 0;
  const revenueAtRiskMax =
    Number(row["revenue_at_risk_max"]) ?? Number(resultSource["revenueAtRiskMax"]) ?? 0;
  const riskCount = Number(row["risk_count"]) || risks.length;

  const result = {
    moneyImpactSummary: String(
      resultSource["moneyImpactSummary"] ?? `${risks.length} risk(s) detected.`
    ),
    revenueAtRiskMin,
    revenueAtRiskMax,
    protectionScore,
    risks,
    nextStep: String(resultSource["nextStep"] ?? "Review all flagged clauses before signing."),
    rawExtractedClauses: (resultSource["rawExtractedClauses"] as string[]) ?? [],
  };

  return {
    id: row["id"] as string,
    userId: row["user_id"] as string,
    contractName: (row["contract_name"] as string) ?? "",
    contractText: (row["contract_text"] as string) ?? "",
    result,
    createdAt: row["created_at"] as string,
    protectionScore,
    revenueAtRiskMin,
    revenueAtRiskMax,
    riskCount,
  };
}

// ── HTML Report generator ───────────────────────────────────────────────────

function severityColor(severity: string): string {
  if (severity === "High") return "#ef4444";
  if (severity === "Medium") return "#f59e0b";
  return "#10b981";
}

function severityLabel(severity: string): string {
  if (severity === "High") return "STRUCTURAL VULNERABILITY";
  if (severity === "Medium") return "UNREASONABLE RISK";
  return "STRATEGIC OBSERVATION";
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function generateReportHtml(scan: ReturnType<typeof mapScanRow>): string {
  const result = scan.result as Record<string, unknown>;
  const risks = (result["risks"] as Array<Record<string, unknown>>) ?? [];
  const pathToVictory = (result["pathToVictory"] as string[]) ?? [];
  const nextStep = String(result["nextStep"] ?? "Review all flagged clauses before signing.");
  const summary = String(result["moneyImpactSummary"] ?? "");
  const analysisDate = new Date(scan.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const sc = scoreColor(scan.protectionScore);

  const riskRows = risks.map((risk, idx) => {
    const fixes = (risk["fixes"] ?? {}) as Record<string, string>;
    const col = severityColor(String(risk["severity"] ?? "Low"));
    const lbl = severityLabel(String(risk["severity"] ?? "Low"));
    return `
    <div style="margin-bottom:32px;padding:24px;border:1px solid #1e293b;border-radius:8px;background:#0c0c0c;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="background:${col}15;color:${col};border:1px solid ${col}40;font-family:monospace;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.08em;text-transform:uppercase;">${lbl}</span>
        <span style="background:#1e293b;color:#64748b;font-family:monospace;font-size:10px;padding:3px 8px;border-radius:4px;letter-spacing:0.06em;text-transform:uppercase;">${risk["category"] ?? ""}</span>
      </div>
      <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 16px 0;font-family:Georgia,serif;">${String(idx + 1).padStart(2, "0")}. ${risk["title"] ?? ""}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
        <tr>
          <td style="width:33%;padding:14px;vertical-align:top;border:1px solid #1e293b;background:#0a0a0a;">
            <div style="font-family:monospace;font-size:9px;color:#ef4444;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">▸ Predatory Clause</div>
            <p style="color:#cbd5e1;font-size:12px;font-family:monospace;line-height:1.7;margin:0;">${risk["explanation"] ?? ""}</p>
            <p style="color:#f87171;font-size:11px;font-family:monospace;line-height:1.6;margin:10px 0 0 0;font-style:italic;">${risk["whyThisHurtsYou"] ?? ""}</p>
          </td>
          <td style="width:33%;padding:14px;vertical-align:top;border:1px solid #1e293b;background:#071510;">
            <div style="font-family:monospace;font-size:9px;color:#10b981;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">▸ The Shield — Counter-Clause</div>
            <p style="color:#6ee7b7;font-size:12px;font-family:monospace;line-height:1.7;margin:0;">${fixes["rewrittenClause"] ?? ""}</p>
          </td>
          <td style="width:33%;padding:14px;vertical-align:top;border:1px solid #1e293b;background:#080d18;">
            <div style="font-family:monospace;font-size:9px;color:#60a5fa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">▸ Rebuttal Strategy</div>
            <p style="color:#bfdbfe;font-size:12px;font-family:'Georgia',serif;line-height:1.7;margin:0;font-style:italic;">"${fixes["direct"] ?? ""}"</p>
          </td>
        </tr>
      </table>
    </div>`;
  }).join("\n");

  const victorySteps = pathToVictory.map((step, i) => `
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
      <span style="background:#10b981;color:#000;font-family:monospace;font-size:11px;font-weight:700;min-width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:1px;flex-shrink:0;">${i + 1}</span>
      <p style="color:#d1fae5;font-size:13px;font-family:monospace;line-height:1.7;margin:0;">${step}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>IndiePact Forensic Audit — ${scan.contractName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#050505;color:#f1f5f9;font-family:'Space Mono',monospace;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;}
  @media print{@page{margin:16mm;size:A4;}}
  .page{max-width:1050px;margin:0 auto;padding:48px 40px;}
</style>
</head>
<body><div class="page">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #10b981;padding-bottom:28px;margin-bottom:32px;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="color:#10b981;font-size:22px;">⬡</span>
        <span style="color:#10b981;font-family:monospace;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">IndiePact AI</span>
      </div>
      <h1 style="font-size:26px;font-weight:700;color:#f1f5f9;line-height:1.2;margin-bottom:6px;">Forensic Contract Audit Report</h1>
    </div>
    <div style="text-align:right;">
      <p style="color:#64748b;font-family:monospace;font-size:10px;text-transform:uppercase;">Analysis Date</p>
      <p style="color:#94a3b8;font-family:monospace;font-size:12px;">${analysisDate}</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:36px;">
    <div style="padding:16px;border:1px solid #1e293b;border-radius:8px;background:#0c0c0c;">
      <p style="font-family:monospace;font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Contract</p>
      <p style="color:#f1f5f9;font-size:13px;font-weight:700;">${scan.contractName}</p>
    </div>
    <div style="padding:16px;border:1px solid #1e293b;border-radius:8px;background:#0c0c0c;">
      <p style="font-family:monospace;font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Protection Score</p>
      <p style="color:${sc};font-size:22px;font-weight:700;font-family:monospace;">${scan.protectionScore}<span style="font-size:13px;color:#64748b;">/100</span></p>
    </div>
    <div style="padding:16px;border:1px solid #ef444440;border-radius:8px;background:#1a0000;">
      <p style="font-family:monospace;font-size:9px;color:#f87171;text-transform:uppercase;margin-bottom:6px;">Revenue at Risk</p>
      <p style="color:#ef4444;font-size:14px;font-weight:700;font-family:monospace;">\$${scan.revenueAtRiskMin.toLocaleString()}–\$${scan.revenueAtRiskMax.toLocaleString()}</p>
    </div>
    <div style="padding:16px;border:1px solid #1e293b;border-radius:8px;background:#0c0c0c;">
      <p style="font-family:monospace;font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Findings</p>
      <p style="color:#f1f5f9;font-size:22px;font-weight:700;font-family:monospace;">${risks.length}<span style="font-size:13px;color:#64748b;"> clauses</span></p>
    </div>
  </div>
  <div style="padding:20px 24px;border:1px solid #1e293b;border-left:3px solid #10b981;border-radius:8px;background:#0a0a0a;margin-bottom:36px;">
    <p style="font-family:monospace;font-size:9px;color:#10b981;text-transform:uppercase;margin-bottom:10px;">Executive Summary</p>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.8;">${summary}</p>
  </div>
  <div style="margin-bottom:48px;">
    <h2 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:20px;">Forensic Discovery Table</h2>
    ${riskRows || '<p style="color:#64748b;font-family:monospace;font-size:12px;padding:20px 0;">No risk findings detected.</p>'}
  </div>
  ${pathToVictory.length > 0 ? `<div style="padding:24px;border:1px solid #10b98140;border-radius:8px;background:#071510;margin-bottom:36px;"><p style="font-family:monospace;font-size:9px;color:#10b981;text-transform:uppercase;margin-bottom:16px;">▸ Path to Victory</p>${victorySteps}</div>` : ""}
  <div style="padding:20px 24px;border:1px solid #1e293b;border-left:3px solid #f59e0b;border-radius:8px;background:#0c0a00;margin-bottom:48px;">
    <p style="font-family:monospace;font-size:9px;color:#f59e0b;text-transform:uppercase;margin-bottom:10px;">Recommended Next Step</p>
    <p style="color:#fef3c7;font-size:14px;line-height:1.7;">${nextStep}</p>
  </div>
  <div style="border-top:1px solid #1e293b;padding-top:24px;display:flex;align-items:center;justify-content:space-between;">
    <p style="color:#10b981;font-family:monospace;font-size:11px;font-weight:700;">INDIEPACT AI</p>
    <p style="color:#334155;font-family:monospace;font-size:10px;">Generated ${new Date().toISOString().split("T")[0]}</p>
  </div>
</div></body></html>`;
}

export default router;
