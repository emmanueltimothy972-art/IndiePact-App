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

export function extractRiskyClauses(contractText: string): {
  extractedClauses: string[];
  foundCategories: string[];
} {
  const sentences = contractText
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 20);

  const extractedClauses: Set<string> = new Set();
  const foundCategories: Set<string> = new Set();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const [category, keywords] of Object.entries(RISK_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          extractedClauses.add(sentence.trim());
          foundCategories.add(category);
          break;
        }
      }
    }
  }

  return {
    extractedClauses: Array.from(extractedClauses).slice(0, 30),
    foundCategories: Array.from(foundCategories),
  };
}

export function truncateForAI(clauses: string[]): string {
  const joined = clauses.join("\n\n");
  return joined.length > 8000 ? joined.slice(0, 8000) + "..." : joined;
}
