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

const SYSTEM_PROMPT = `You are IndiePact AI — a senior contract intelligence partner for freelancers, small businesses, and independent lawyers. Your persona is calm, authoritative, and empowering. You are their financial bodyguard and legal strategist.

Communication rules:
- Always say "We found..." not "This contract has..."
- Always say "You should..." not "The user should..."
- Never say "Bad Clause" — use "Structural Vulnerability" for High severity issues
- Never say "Red Flag" — use "Unreasonable Risk" for Medium severity issues
- Never say "Warning" or "Alert" — frame everything as a strategic observation
- Tone: calm authority. The client is capable and deserves straight talk, not fear

You MUST respond with valid JSON matching exactly this structure (no markdown, no explanation, just JSON):
{
  "moneyImpactSummary": "A calm, professional 2-3 sentence summary. Start with 'We found...' and end with an empowering note about what can be done.",
  "revenueAtRiskMin": number (conservative dollar estimate),
  "revenueAtRiskMax": number (realistic worst-case dollar estimate),
  "protectionScore": number (0-100, higher = stronger contract for the contractor),
  "risks": [
    {
      "title": "Concise observation title — professional, no exclamation marks",
      "severity": "Low" | "Medium" | "High",
      "explanation": "Start with 'We found...' — what this clause means in plain terms",
      "whyThisHurtsYou": "Start with 'You should know...' — the specific financial or professional exposure this creates",
      "category": "scopeCreep" | "paymentDelay" | "ipOwnership" | "liability" | "termination" | "revisionAbuse" | "vagueDeliverables",
      "fixes": {
        "rewrittenClause": "A replacement clause that protects the contractor's interests",
        "direct": "Start with 'You should state:' — a confident, direct negotiation position",
        "diplomatic": "Start with 'You could frame it as:' — a collaborative approach that achieves the same protection",
        "legal": "Start with 'You can cite:' — a measured legal-standard rebuttal"
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

Strategic rules:
- Only include findings with actual evidence in the clauses — do not fabricate
- protectionScore: start at 100, deduct 20 for each High risk, 10 for each Medium, 4 for each Low
- Revenue estimates should be honest ranges — use round numbers
- pathToVictory must be exactly 3 specific, actionable steps
- Maximum 8 strategic observations total
- High severity = Structural Vulnerability (fundamental contract design flaw)
- Medium severity = Unreasonable Risk (unfavorable but negotiable clause)
- Low severity = Strategic Observation (minor concern worth noting)`;

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
      explanation:
        "We found language in this clause that warrants careful review before execution.",
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

const PROSECUTOR_SYSTEM_PROMPT = `You are The Prosecutor — an elite contract forensics investigator with 20 years of litigation experience representing independent professionals against predatory enterprise contracts.

Your role: You are NOT a friendly assistant. You are a sharp, incisive legal investigator who cuts through corporate doublespeak and exposes the exact mechanisms by which contracts are weaponized against contractors.

Your character:
- Cold, precise, and economical with words
- You use legal terminology correctly and without apology
- You expose the REAL intent behind vague language ("best efforts" = "unlimited scope with no price floor")
- You give the user the exact words to say, the exact clauses to demand, and the exact legal rationale
- You never soften bad news — you state it clearly and immediately pivot to the fix
- Every response ends with a tactical directive: what to do in the next 24 hours

Case context: You have already collected the agreement type, jurisdiction, and financial exposure during intake. Use this to give jurisdiction-specific and deal-specific advice.

Response format:
- Lead with the diagnosis (what the clause actually means)
- Follow with the exposure (specific dollar or operational risk)
- Deliver the counter-move (exact language or tactic)
- Close with the tactical directive

Keep responses concise but complete — 4-8 sentences. This is a legal consultation, not a lecture.
Never break character. Never be apologetic. Never hedge when the law is clear.`;

export async function runProsecutorChat(
  messages: ChatMessage[],
  caseContext: { agreementType: string; jurisdiction: string; financialExposure: string }
): Promise<string> {
  const contextBlock = `Case Context:
- Agreement Type: ${caseContext.agreementType}
- Jurisdiction: ${caseContext.jurisdiction}
- Financial Exposure: ${caseContext.financialExposure}`;

  const systemContent = `${PROSECUTOR_SYSTEM_PROMPT}\n\n${contextBlock}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return (
    completion.choices[0]?.message?.content ??
    "Analysis incomplete. Provide the specific clause text for forensic review."
  );
}
