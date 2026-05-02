import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];

if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

export const openai = new OpenAI({ apiKey });

export interface AnalysisResult {
  moneyImpactSummary: string;
  revenueAtRiskMin: number;
  revenueAtRiskMax: number;
  protectionScore: number;
  risks: Array<{
    title: string;
    severity: "Low" | "Medium" | "High";
    explanation: string;
    whyThisHurtsYou: string;
    category: string;
    fixes: {
      rewrittenClause: string;
      direct: string;
      diplomatic: string;
      legal: string;
    };
  }>;
  nextStep: string;
  rawExtractedClauses: string[];
}

const SYSTEM_PROMPT = `You are IndiePact AI, a contract risk analysis engine for freelancers, small businesses, and lawyers. 
Analyze the provided contract clauses and return a structured JSON risk report.

You MUST respond with valid JSON matching exactly this structure (no markdown, no explanation, just JSON):
{
  "moneyImpactSummary": "string explaining financial impact in plain language",
  "revenueAtRiskMin": number (dollar amount),
  "revenueAtRiskMax": number (dollar amount),  
  "protectionScore": number (0-100, higher = safer contract),
  "risks": [
    {
      "title": "short risk title",
      "severity": "Low" | "Medium" | "High",
      "explanation": "what this clause means and why it's risky",
      "whyThisHurtsYou": "specific financial and professional harm to freelancer/contractor",
      "category": "scopeCreep" | "paymentDelay" | "ipOwnership" | "liability" | "termination" | "revisionAbuse" | "vagueDeliverables",
      "fixes": {
        "rewrittenClause": "improved replacement clause text",
        "direct": "direct negotiation rebuttal",
        "diplomatic": "diplomatic negotiation rebuttal",
        "legal": "legal-style rebuttal referencing contract law principles"
      }
    }
  ],
  "nextStep": "top recommended action for the user"
}

Rules:
- Only include real risks found in the clauses — do not fabricate risks not present
- protectionScore: start at 100, deduct 25 for each High risk, 10 for each Medium, 5 for each Low
- revenueAtRiskMin/Max: estimate based on clause severity — use ranges (e.g. 5000-25000), not precise numbers
- All monetary estimates should be realistic ranges for a freelancer/small business contract
- Be concise but specific — no generic advice
- Do not exceed 8 risks total`;

export async function analyzeContractClauses(
  clauses: string[],
  foundCategories: string[]
): Promise<AnalysisResult> {
  const clauseText = clauses.join("\n\n---\n\n");

  const userMessage = `Contract clauses to analyze (pre-filtered for risk categories: ${foundCategories.join(", ")}):

${clauseText}

Return the JSON risk analysis now.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  try {
    const parsed = JSON.parse(content) as AnalysisResult;

    if (
      typeof parsed.protectionScore !== "number" ||
      !Array.isArray(parsed.risks)
    ) {
      throw new Error("Malformed AI response structure");
    }

    parsed.rawExtractedClauses = clauses;
    parsed.protectionScore = Math.max(
      0,
      Math.min(100, parsed.protectionScore)
    );

    return parsed;
  } catch {
    throw new Error("Failed to parse AI analysis response");
  }
}

export function buildFallbackResult(
  clauses: string[],
  foundCategories: string[]
): AnalysisResult {
  const riskCount = foundCategories.length;
  return {
    moneyImpactSummary:
      "Unable to complete AI analysis. Pre-filter detected potential risk areas in the contract.",
    revenueAtRiskMin: riskCount * 1000,
    revenueAtRiskMax: riskCount * 10000,
    protectionScore: Math.max(20, 100 - riskCount * 15),
    risks: foundCategories.map((cat) => ({
      title: `Potential ${cat} issue detected`,
      severity: "Medium" as const,
      explanation:
        "This section contains language that may create financial or legal risk.",
      whyThisHurtsYou:
        "This clause could expose you to financial loss or legal liability.",
      category: cat,
      fixes: {
        rewrittenClause: "Please review this clause with a legal professional.",
        direct: "Request clarification and amendment of this clause.",
        diplomatic:
          "I would like to discuss a few terms before signing to ensure we are aligned.",
        legal: "This clause may conflict with standard contractor protections under applicable law.",
      },
    })),
    nextStep:
      "Review the flagged clauses with a legal professional before signing.",
    rawExtractedClauses: clauses,
  };
}
