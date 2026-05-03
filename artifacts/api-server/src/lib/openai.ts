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
  pathToVictory: string[];
  nextStep: string;
  rawExtractedClauses: string[];
}

const SYSTEM_PROMPT = `You are IndiePact AI — a calm, authoritative contract intelligence engine for freelancers, small businesses, and independent lawyers. Your tone is that of a seasoned general counsel: measured, precise, and quietly powerful. Never alarmist. Always strategic.

You MUST respond with valid JSON matching exactly this structure (no markdown, no explanation, just JSON):
{
  "moneyImpactSummary": "A calm, professional summary of financial exposure — 2-3 sentences, factual tone",
  "revenueAtRiskMin": number (conservative dollar estimate),
  "revenueAtRiskMax": number (realistic worst-case dollar estimate),
  "protectionScore": number (0-100, higher = stronger contract for the contractor),
  "risks": [
    {
      "title": "Concise observation title — no exclamation marks",
      "severity": "Low" | "Medium" | "High",
      "explanation": "What this clause means in plain terms — calm and precise",
      "whyThisHurtsYou": "The specific financial or professional exposure this creates",
      "category": "scopeCreep" | "paymentDelay" | "ipOwnership" | "liability" | "termination" | "revisionAbuse" | "vagueDeliverables",
      "fixes": {
        "rewrittenClause": "A replacement clause that protects the contractor's interests",
        "direct": "A confident, direct negotiation position to take",
        "diplomatic": "A collaborative framing that achieves the same protection",
        "legal": "A measured legal-standard rebuttal citing applicable principles"
      }
    }
  ],
  "pathToVictory": [
    "Step 1 — a specific, actionable negotiation move",
    "Step 2 — a follow-up tactic or protection measure",
    "Step 3 — a final safeguard or escalation path"
  ],
  "nextStep": "The single most important action the user should take right now"
}

Strategic rules:
- Frame every finding as a "Strategic Observation," not a red flag or warning
- Only include observations with actual evidence in the clauses — do not fabricate
- protectionScore: start at 100, deduct 20 for each High risk, 10 for each Medium, 4 for each Low
- Revenue estimates should be honest ranges, not precise — use round numbers
- pathToVictory must be exactly 3 specific steps that give the user a clear negotiation path
- Maximum 8 strategic observations total
- Tone: calm authority. The user is capable and deserves straight talk, not fear`;

export async function analyzeContractClauses(
  clauses: string[],
  foundCategories: string[]
): Promise<AnalysisResult> {
  const clauseText = clauses.join("\n\n---\n\n");

  const userMessage = `Contract clauses requiring strategic analysis (pre-filtered categories: ${foundCategories.join(", ")}):

${clauseText}

Return your JSON intelligence report now.`;

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
  if (!content) throw new Error("No response from AI");

  try {
    const parsed = JSON.parse(content) as AnalysisResult;
    if (typeof parsed.protectionScore !== "number" || !Array.isArray(parsed.risks)) {
      throw new Error("Malformed AI response structure");
    }
    parsed.rawExtractedClauses = clauses;
    parsed.protectionScore = Math.max(0, Math.min(100, parsed.protectionScore));
    if (!Array.isArray(parsed.pathToVictory) || parsed.pathToVictory.length === 0) {
      parsed.pathToVictory = DEFAULT_PATH_TO_VICTORY;
    }
    return parsed;
  } catch {
    throw new Error("Failed to parse AI analysis response");
  }
}

const DEFAULT_PATH_TO_VICTORY = [
  "Request a 48-hour review period before signing — this is standard and reasonable.",
  "Prioritize your top 2 concerns and propose written amendments via email to create a paper trail.",
  "If the counterparty rejects amendments, consider whether the engagement is worth the exposure.",
];

export function buildFallbackResult(
  clauses: string[],
  foundCategories: string[]
): AnalysisResult {
  const riskCount = foundCategories.length;
  return {
    moneyImpactSummary:
      "Pre-filter analysis detected several clauses that warrant strategic review before signing. A full AI analysis will provide precise exposure estimates.",
    revenueAtRiskMin: riskCount * 1000,
    revenueAtRiskMax: riskCount * 10000,
    protectionScore: Math.max(20, 100 - riskCount * 15),
    risks: foundCategories.map((cat) => ({
      title: `Strategic Observation: ${cat.replace(/([A-Z])/g, " $1").trim()}`,
      severity: "Medium" as const,
      explanation:
        "This clause contains language that warrants careful review before execution.",
      whyThisHurtsYou:
        "Without amendment, this clause could create financial exposure or operational constraints.",
      category: cat,
      fixes: {
        rewrittenClause:
          "Replace with language that clearly defines scope, timeline, and compensation for any additional obligations.",
        direct:
          "I'd like to discuss this clause before we proceed — it needs to be more precisely defined.",
        diplomatic:
          "To ensure we're fully aligned on expectations, I'd suggest we clarify the language here.",
        legal:
          "This clause as drafted may create ambiguity that, under standard contract interpretation principles, would be construed against the drafter.",
      },
    })),
    pathToVictory: DEFAULT_PATH_TO_VICTORY,
    nextStep:
      "Request a 48-hour review window and prepare written amendment proposals for the flagged clauses.",
    rawExtractedClauses: clauses,
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const NEGOTIATOR_SYSTEM_PROMPT = `You are playing the role of a client's in-house lawyer in a contract negotiation rehearsal. The user is a freelancer or independent professional practicing their negotiation skills.

Your character: Calm, experienced, slightly firm. You represent the client's interests but you are not hostile — you are a professional doing your job. You push back on contractor requests but you can be reasoned with when arguments are sound.

Your goal: Give the user a realistic rehearsal partner so they can practice defending their position. When the user makes a strong, legally grounded argument, acknowledge it and consider conceding partially. When their argument is weak, push back professionally.

Keep responses concise — 2-4 sentences maximum. This is a dialogue, not a monologue.
Never break character. Never explain that you are an AI.`;

export async function runNegotiatorChat(
  messages: ChatMessage[],
  scenario: string
): Promise<string> {
  const systemContent = `${NEGOTIATOR_SYSTEM_PROMPT}\n\nScenario: ${scenario}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content ?? "I understand your position. Let me consider that.";
}
