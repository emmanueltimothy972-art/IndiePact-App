import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];

if (!apiKey) {
  console.warn(
    "[IndiePact API] OPENAI_API_KEY is not set.\n" +
    "Contract analysis endpoints will return fallback responses until the key is configured."
  );
}

export const openai: OpenAI | null = apiKey ? new OpenAI({ apiKey }) : null;

export function requireOpenAI(): OpenAI {
  if (!openai) {
    throw Object.assign(
      new Error("AI analysis is temporarily unavailable — OpenAI key not configured."),
      { statusCode: 503 }
    );
  }
  return openai;
}

// ─── Shared types ─────────────────────────────────────────────────────────────

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LegalStrategyResult {
  overallAssessment: string;
  powerBalance: {
    score: number;
    label: "Strong" | "Balanced" | "Unfavorable" | "Weak";
    explanation: string;
  };
  priorityRisks: Array<{
    rank: number;
    title: string;
    urgency: "Immediate" | "High" | "Moderate";
    impact: string;
    negotiationApproach: string;
  }>;
  negotiationOrder: Array<{
    step: number;
    action: string;
    rationale: string;
    tactic: "Anchor" | "Trade" | "Reframe" | "Walk Away" | "Request";
  }>;
  questionsToAsk: string[];
  redFlags: Array<{
    clause: string;
    interpretation: string;
    realWorldImpact: string;
  }>;
  recommendedMove: string;
  checklist: Array<{
    item: string;
    priority: "High" | "Medium" | "Low";
  }>;
}

export interface ProsecutorResponse {
  diagnosis: string;
  exposure: string;
  counterMove: string;
  rebuttalEmail: string;
  tacticalDirective: string;
}

// ─── System Prompt Factory ────────────────────────────────────────────────────
// Route A = Dashboard/Review  → Educational Assistant (plain English, clear, calm)
// Route B = War Room          → The Prosecutor (litigation attorney, adversarial, zero politeness)

export type AIRoute = "review" | "warroom";

export function buildSystemPrompt(route: AIRoute): string {
  if (route === "review") {
    return `You are IndiePact AI — a senior contract intelligence partner for freelancers and small businesses.

TONE: Educational Assistant. Speak like a trusted mentor who wants the user to succeed.
- Simplify legal jargon into 6th-grade English.
- Be encouraging and clear — never alarmist.
- Frame risks as learnable, fixable problems, not threats.
- Always say "We found..." not "This contract has..."
- Always say "You should..." not "The user should..."
- Never say "Bad Clause" — use "Structural Vulnerability" for High severity issues
- Never say "Red Flag" — use "Unreasonable Risk" for Medium severity issues

COST CONTROL: You MUST respond in strictly structured JSON only. No markdown, no intro sentences, no conclusion text. Pure JSON.

JSON structure:
{
  "moneyImpactSummary": "2-3 sentences. Start with 'We found...' End with an empowering note.",
  "revenueAtRiskMin": <number>,
  "revenueAtRiskMax": <number>,
  "protectionScore": <0-100, higher = stronger contract for the contractor>,
  "risks": [
    {
      "title": "Concise professional title",
      "severity": "Low" | "Medium" | "High",
      "explanation": "Start with 'We found...' — plain English explanation",
      "whyThisHurtsYou": "Start with 'You should know...' — specific financial or professional exposure",
      "category": "scopeCreep" | "paymentDelay" | "ipOwnership" | "liability" | "termination" | "revisionAbuse" | "vagueDeliverables",
      "fixes": {
        "rewrittenClause": "Replacement clause protecting contractor interests",
        "direct": "Start with 'You should state:' — confident, direct negotiation position",
        "diplomatic": "Start with 'You could frame it as:' — collaborative approach",
        "legal": "Start with 'You can cite:' — measured legal-standard rebuttal"
      }
    }
  ],
  "pathToVictory": [
    "You should [specific action] — [brief rationale]",
    "You should [follow-up tactic] — [brief rationale]",
    "You should [final safeguard] — [brief rationale]"
  ],
  "nextStep": "The single most important action. Start with 'You should...'"
}

Rules:
- protectionScore: start at 100, deduct 20 per High risk, 10 per Medium, 4 per Low
- pathToVictory must be exactly 3 steps
- Maximum 8 risk findings
- Only include findings with actual evidence in the clauses`;
  }

  return `You are The Prosecutor — an elite contract forensics investigator with 20 years of high-stakes litigation experience representing independent professionals against predatory enterprise contracts.

TONE: Act as a high-stakes litigation attorney.
- Identify adversarial clauses with zero politeness.
- Cold, precise, economical with words.
- Expose the REAL intent behind vague language ("best efforts" = "unlimited scope with no price floor").
- Never soften bad news — state it clearly, then immediately pivot to the fix.
- Every response ends with a tactical directive: what to do in the next 24 hours.

COST CONTROL: You MUST respond in strictly structured JSON only. No markdown, no intro sentences, no conclusion text. Pure JSON. This is critical for cost efficiency.

JSON structure (return ONLY this, nothing else):
{
  "diagnosis": "What this clause actually means in plain adversarial terms. Lead with the hidden mechanism.",
  "exposure": "The specific dollar amount or operational risk. Use exact figures where possible.",
  "counterMove": "The exact language to demand or the precise tactic to deploy. Quote specific contract language.",
  "rebuttalEmail": "A complete, ready-to-send email. Format: 'Subject: [subject]\\n\\nDear [Client/Counterparty],\\n\\n[Body — firm, legally protective, professional. 3-4 paragraphs. Sign as: The Contractor]'",
  "tacticalDirective": "Single sentence. What to do in the next 24 hours."
}`;
}

// ─── Route A: Contract Analysis (Educational) ─────────────────────────────────

export async function analyzeContractClauses(
  clauses: string[],
  foundCategories: string[]
): Promise<AnalysisResult> {
  const client = requireOpenAI();
  const clauseText = clauses.join("\n\n---\n\n");

  const userMessage = `Contract clauses requiring strategic analysis (pre-filtered categories: ${foundCategories.join(", ")}):

${clauseText}

Return your JSON intelligence report now.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildSystemPrompt("review") },
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

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
}

const DEFAULT_PATH_TO_VICTORY = [
  "You should request a 48-hour review period before signing — this is standard practice and sets a professional tone.",
  "You should prioritize your top 2 concerns and send written amendment proposals via email to create a defensible paper trail.",
  "You should evaluate whether the counterparty's response to amendments reflects a partnership worth entering — silence or hostility is data.",
];

export function buildFallbackResult(
  clauses: string[],
  foundCategories: string[]
): AnalysisResult {
  const riskCount = foundCategories.length;
  return {
    moneyImpactSummary:
      "We found several clauses that warrant strategic review before signing. You should request a review window to address these findings before execution.",
    revenueAtRiskMin: riskCount * 1000,
    revenueAtRiskMax: riskCount * 10000,
    protectionScore: Math.max(20, 100 - riskCount * 15),
    risks: foundCategories.map((cat) => ({
      title: `${cat === "paymentDelay" ? "Unreasonable Risk" : "Strategic Observation"}: ${cat.replace(/([A-Z])/g, " $1").trim()}`,
      severity: "Medium" as const,
      explanation: "We found language in this clause that warrants careful review before execution.",
      whyThisHurtsYou:
        "You should know that without amendment, this clause could create financial exposure or operational constraints.",
      category: cat,
      fixes: {
        rewrittenClause:
          "Replace with language that clearly defines scope, timeline, and compensation for any additional obligations.",
        direct:
          "You should state: I'd like to discuss this clause before we proceed — it needs to be more precisely defined to protect both parties.",
        diplomatic:
          "You could frame it as: To ensure we're fully aligned on expectations and to protect our working relationship, I'd suggest we clarify this language.",
        legal:
          "You can cite: This clause as drafted may create ambiguity that, under standard contract interpretation principles, would be construed against the drafter.",
      },
    })),
    pathToVictory: DEFAULT_PATH_TO_VICTORY,
    nextStep:
      "You should request a 48-hour review window and prepare written amendment proposals for the flagged clauses.",
    rawExtractedClauses: clauses,
  };
}

// ─── Negotiator Chat (War Room — Rehearsal Partner) ───────────────────────────

const NEGOTIATOR_SYSTEM_PROMPT = `You are playing the role of a client's in-house lawyer in a contract negotiation rehearsal. The user is a freelancer practicing their negotiation skills.

TONE: Calm, experienced, slightly firm. You represent the client's interests but you are professional — not hostile. You push back on contractor requests but can be reasoned with when arguments are sound.

Goal: Give the user a realistic rehearsal partner. When they make a strong, legally grounded argument, acknowledge it and partially concede. When their argument is weak, push back professionally.

Keep responses concise — 2-4 sentences maximum. This is a dialogue, not a monologue.
Never break character. Never explain that you are an AI.`;

export async function runNegotiatorChat(
  messages: ChatMessage[],
  scenario: string
): Promise<string> {
  const client = requireOpenAI();
  const systemContent = `${NEGOTIATOR_SYSTEM_PROMPT}\n\nScenario: ${scenario}`;

  const completion = await client.chat.completions.create({
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

// ─── Route B: The Prosecutor (War Room — structured JSON) ─────────────────────

export async function runProsecutorChat(
  messages: ChatMessage[],
  caseContext: { agreementType: string; jurisdiction: string; financialExposure: string }
): Promise<ProsecutorResponse> {
  const client = requireOpenAI();
  const contextBlock = `Case Context:
- Agreement Type: ${caseContext.agreementType}
- Jurisdiction: ${caseContext.jurisdiction}
- Financial Exposure: ${caseContext.financialExposure}`;

  const systemContent = `${buildSystemPrompt("warroom")}\n\n${contextBlock}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content) as ProsecutorResponse;
  if (!parsed.diagnosis || !parsed.rebuttalEmail) {
    throw new Error("Malformed prosecutor response");
  }
  return parsed;
}

// ─── Legal Strategy Analysis ──────────────────────────────────────────────────

const LEGAL_STRATEGY_PROMPT = `You are IndiePact's AI Legal Strategy Engine — a senior contract strategy advisor for independent professionals.

Your role: Assess power dynamics, prioritize issues, create a negotiation roadmap, identify must-answer questions, flag the most dangerous clauses, and recommend the single most important next move.

Tone: Calm, authoritative, professional. Never alarmist. Clear and actionable.
Important: This is AI-assisted strategy, not legal advice.

COST CONTROL: Respond in strictly structured JSON only. No markdown, no code fences, no intro text.

{
  "overallAssessment": "2-3 sentence strategic summary starting with 'Based on our analysis...'",
  "powerBalance": {
    "score": <0-100, 50=balanced, below 50=unfavorable for you, above 50=favorable>,
    "label": "Strong" | "Balanced" | "Unfavorable" | "Weak",
    "explanation": "1-2 sentences on the power dynamic"
  },
  "priorityRisks": [
    {
      "rank": 1,
      "title": "string",
      "urgency": "Immediate" | "High" | "Moderate",
      "impact": "Plain English: what this costs you if unaddressed",
      "negotiationApproach": "Specific tactic to address this"
    }
  ],
  "negotiationOrder": [
    {
      "step": 1,
      "action": "What to do at this step",
      "rationale": "Why this order matters",
      "tactic": "Anchor" | "Trade" | "Reframe" | "Walk Away" | "Request"
    }
  ],
  "questionsToAsk": ["5-7 specific questions to ask before signing"],
  "redFlags": [
    {
      "clause": "The problematic language",
      "interpretation": "What it really means in plain English",
      "realWorldImpact": "The specific consequence for you"
    }
  ],
  "recommendedMove": "The single most important action to take in the next 24 hours",
  "checklist": [
    {
      "item": "Specific action item",
      "priority": "High" | "Medium" | "Low"
    }
  ]
}

Rules: priorityRisks ranked by financial impact; negotiationOrder 3-5 steps; questionsToAsk 5-7 items; redFlags max 3; checklist 7-10 items.`;

export async function runLegalStrategyAnalysis(
  risks: Array<{ title: string; severity: string; explanation: string; whyThisHurtsYou: string; category: string; fixes: { rewrittenClause: string; direct: string } }>,
  protectionScore: number,
  moneyImpactSummary: string
): Promise<LegalStrategyResult> {
  const client = requireOpenAI();
  const riskSummary = risks.map((r, i) =>
    `Risk ${i + 1} [${r.severity}] - ${r.title}\nCategory: ${r.category}\nExplanation: ${r.explanation}\nWhy it hurts: ${r.whyThisHurtsYou}`
  ).join("\n\n");

  const userMessage = `Contract Protection Score: ${protectionScore}/100\nSummary: ${moneyImpactSummary}\n\nIdentified Risks:\n${riskSummary}\n\nGenerate the strategic analysis now.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: LEGAL_STRATEGY_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.25,
    max_tokens: 2500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");
  return JSON.parse(content) as LegalStrategyResult;
}
