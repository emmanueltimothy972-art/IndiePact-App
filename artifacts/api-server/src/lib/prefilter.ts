const RISK_KEYWORDS: Record<string, string[]> = {
  scopeCreep: [
    "as needed",
    "additional services",
    "at client's discretion",
    "without additional compensation",
    "reasonable requests",
    "may be required",
    "such other duties",
    "other tasks as assigned",
    "and any other",
    "unlimited revisions",
    "as requested",
  ],
  paymentDelay: [
    "net 60",
    "net 90",
    "net 120",
    "upon completion",
    "upon acceptance",
    "at client's sole discretion",
    "after approval",
    "when invoiced",
    "within 90 days",
    "within 60 days",
    "deferred payment",
    "payment schedule",
    "payment terms",
    "late payment",
    "payment upon",
  ],
  ipOwnership: [
    "work for hire",
    "work-for-hire",
    "all intellectual property",
    "assigns all rights",
    "all rights reserved to client",
    "client shall own",
    "client retains all",
    "company owns",
    "perpetual license",
    "irrevocable license",
    "royalty-free",
    "without restriction",
    "client's exclusive property",
  ],
  liability: [
    "indemnify",
    "indemnification",
    "hold harmless",
    "liable for",
    "liability",
    "consequential damages",
    "unlimited liability",
    "any and all damages",
    "at your own risk",
    "no cap on damages",
    "sole responsibility",
  ],
  termination: [
    "terminate at will",
    "immediate termination",
    "without cause",
    "without notice",
    "no severance",
    "forfeit",
    "upon termination",
    "cancel at any time",
    "no compensation upon",
    "upon cancellation",
  ],
  revisionAbuse: [
    "unlimited revisions",
    "revisions as needed",
    "until satisfied",
    "client's satisfaction",
    "until accepted",
    "as many revisions",
    "revision cycles",
    "changes at no cost",
    "no limit on revisions",
  ],
  vagueDeliverables: [
    "as discussed",
    "as agreed",
    "high quality",
    "best efforts",
    "reasonable quality",
    "to be determined",
    "tbd",
    "mutually agreed upon",
    "project scope",
    "deliverables as outlined",
    "standard deliverables",
  ],
};

export interface ExtractedClause {
  text: string;
  categories: string[];
  sentences: string[];
}

// ─── Sentence tokeniser ────────────────────────────────────────────────────────

function tokeniseSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

// ─── Core extraction (single pass over sentence list) ─────────────────────────

function extractFromSentences(sentences: string[]): {
  clauses: Set<string>;
  categories: Set<string>;
} {
  const clauses = new Set<string>();
  const categories = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const [category, keywords] of Object.entries(RISK_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          clauses.add(sentence.trim());
          categories.add(category);
          break;
        }
      }
    }
  }

  return { clauses, categories };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * For large documents (> 20 000 chars), split into overlapping 5 000-char
 * chunks so we never miss risky clauses near chunk boundaries.
 * For normal documents, use a single pass — same behaviour as before.
 */
export function extractRiskyClauses(contractText: string): {
  extractedClauses: string[];
  foundCategories: string[];
} {
  const CHUNK_SIZE = 5_000;
  const OVERLAP = 500;
  const LARGE_DOC_THRESHOLD = 20_000;

  let allClauses = new Set<string>();
  let allCategories = new Set<string>();

  if (contractText.length <= LARGE_DOC_THRESHOLD) {
    // Fast path — process in one go
    const sentences = tokeniseSentences(contractText);
    const { clauses, categories } = extractFromSentences(sentences);
    allClauses = clauses;
    allCategories = categories;
  } else {
    // Chunked path — ensures full-document coverage
    let offset = 0;
    while (offset < contractText.length) {
      const chunk = contractText.slice(offset, offset + CHUNK_SIZE);
      const sentences = tokeniseSentences(chunk);
      const { clauses, categories } = extractFromSentences(sentences);
      clauses.forEach((c) => allClauses.add(c));
      categories.forEach((c) => allCategories.add(c));
      offset += CHUNK_SIZE - OVERLAP;
    }
  }

  return {
    // Allow up to 40 clauses (up from 30) to improve large-doc coverage
    extractedClauses: Array.from(allClauses).slice(0, 40),
    foundCategories: Array.from(allCategories),
  };
}

/**
 * Smart truncation: prioritise clauses that mention the highest-signal
 * risk categories and trim to a safe AI context window.
 */
export function truncateForAI(clauses: string[]): string {
  const HIGH_SIGNAL = ["liability", "ipOwnership", "paymentDelay", "termination"];

  // Sort: high-signal categories first
  const scored = clauses.map((c) => {
    const lower = c.toLowerCase();
    let score = 0;
    for (const [cat, keywords] of Object.entries(RISK_KEYWORDS)) {
      if (HIGH_SIGNAL.includes(cat)) {
        for (const kw of keywords) {
          if (lower.includes(kw)) { score += 2; break; }
        }
      }
    }
    return { c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const sorted = scored.map((s) => s.c);

  const joined = sorted.join("\n\n");
  // Increased limit to 12 000 chars (gpt-4o-mini handles it comfortably)
  return joined.length > 12_000 ? joined.slice(0, 12_000) + "\n\n[…further sections omitted — priority clauses preserved above]" : joined;
}
