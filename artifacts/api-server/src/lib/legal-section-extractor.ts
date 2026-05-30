// ─── Legal Section Extractor ──────────────────────────────────────────────────
//
// Splits a contract into named sections and scores each one by legal relevance.
// Returns the most relevant sections within a configurable character budget,
// preserving full clause boundaries and discarding low-signal boilerplate.
//
// This runs BEFORE prefilter.ts — it gives the downstream risky-clause
// extractor a cleaner, higher-density input corpus.

// ─── Scoring tables ───────────────────────────────────────────────────────────

const HIGH_VALUE_SECTION_PATTERNS: RegExp[] = [
  /\bdefin/i,
  /\bobligation/i,
  /\bliabilit/i,
  /\bindemnif/i,
  /\bterminat/i,
  /\bpayment/i,
  /\bcompensation/i,
  /\bconfidential/i,
  /\bintellectual\s+property/i,
  /\bip\s+owner/i,
  /\bproprietary/i,
  /\bdispute/i,
  /\barbitration/i,
  /\bgoverning\s+law/i,
  /\bjurisdiction/i,
  /\bnon.compete/i,
  /\bnon.solicitation/i,
  /\bpenalt/i,
  /\bexclusiv/i,
  /\bforce\s+majeure/i,
  /\blimitation\s+of\s+liabilit/i,
  /\bwarrant/i,
  /\brepresent/i,
  /\bremed/i,
  /\bcovenant/i,
  /\bassignment/i,
  /\bsublicens/i,
  /\bchange\s+of\s+control/i,
  /\baudit\s+right/i,
  /\bdata\s+protection/i,
  /\bprivacy/i,
  /\bsecurity/i,
  /\binsurance/i,
  /\bemployment/i,
  /\bwork\s+for\s+hire/i,
  /\bseverance/i,
  /\bnon.disclosure/i,
];

const LOW_VALUE_SECTION_PATTERNS: RegExp[] = [
  /\brecital/i,
  /\bwhereas/i,
  /\bbackground/i,
  /\btable\s+of\s+contents/i,
  /\bsignature\s+block/i,
  /\bexhibit\b/i,
  /\bschedule\b/i,
  /\bappendix\b/i,
  /\bwitness(eth)?\b/i,
  /\backnowledg/i,
  /\bforeword/i,
  /\bpreamble/i,
  /\bcover\s+page/i,
];

// ─── Section-heading detector ──────────────────────────────────────────────────
// Matches the most common legal document heading formats.

const HEADING_RE = /^(?:(?:ARTICLE|SECTION|CLAUSE)\s+[IVXLCDM\d]+[.):\s-]|(?:\d+(?:\.\d+){0,3})\s*[.):\s]|[A-Z][A-Z\s,&]{4,}(?::|\.)?$)/m;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 120) return false;
  return HEADING_RE.test(t);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  heading: string;
  body: string;
  score: number;
  charCount: number;
  priority: "high" | "medium" | "low";
}

export interface RawSection {
  heading: string;
  body: string;
}

export interface ExtractionStats {
  originalChars: number;
  sectionCount: number;
  selectedSections: number;
  extractedChars: number;
  reductionPct: number;
  wasBudgetConstrained: boolean;
}

// ─── Section splitter ─────────────────────────────────────────────────────────

function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentHeading = "(preamble)";
  let currentLines: string[] = [];

  const finalise = () => {
    const body = currentLines.join("\n").trim();
    if (body.length < 20) return; // Skip nearly-empty sections
    const combined = (currentHeading + " " + body).toLowerCase();

    let score = 0;
    let priority: "high" | "medium" | "low" = "medium";

    for (const p of HIGH_VALUE_SECTION_PATTERNS) {
      if (p.test(combined)) {
        score += 10;
        priority = "high";
      }
    }
    for (const p of LOW_VALUE_SECTION_PATTERNS) {
      if (p.test(currentHeading.toLowerCase())) {
        score -= 15;
        priority = score < 0 ? "low" : priority;
      }
    }

    // Body-level risk signal — boost sections that contain risky language
    const riskSignals = [
      /indemnif/i, /terminat.*without\s+cause/i, /sole\s+discretion/i,
      /work.for.hire/i, /irrevocable/i, /perpetual/i, /unlimited/i,
      /net\s+[69]\d/i, /without\s+compensation/i, /at\s+client['']?s/i,
    ];
    for (const p of riskSignals) {
      if (p.test(body)) score += 5;
    }

    sections.push({
      heading: currentHeading,
      body,
      score,
      charCount: currentHeading.length + body.length + 2,
      priority,
    });
  };

  for (const line of lines) {
    if (looksLikeHeading(line)) {
      finalise();
      currentHeading = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  finalise();

  return sections;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const DEFAULT_CHAR_BUDGET = 40_000; // ≈ 10 000 tokens @ 4 chars/token

/**
 * Extract the legally relevant sections of a normalised contract text.
 *
 * Returns:
 *  - `text`        : sections ordered by legal relevance, within the char budget.
 *  - `stats`       : telemetry payload for server-side logging.
 *  - `rawSections` : the individual {heading, body} pairs (used for structured tagging).
 *
 * If the document is already short enough (< budget), ALL sections are returned
 * so no legal context is ever lost for normal-sized contracts.
 */
export function extractLegalSections(
  text: string,
  charBudget = DEFAULT_CHAR_BUDGET,
): { text: string; stats: ExtractionStats; rawSections: RawSection[] } {
  const originalChars = text.length;
  const sections = splitIntoSections(text);

  // Fast-path: document fits in budget — return all sections, no filtering.
  if (originalChars <= charBudget) {
    const rawSections: RawSection[] = sections.map((s) => ({
      heading: s.heading,
      body: s.body,
    }));
    return {
      text,
      stats: {
        originalChars,
        sectionCount: sections.length,
        selectedSections: sections.length,
        extractedChars: originalChars,
        reductionPct: 0,
        wasBudgetConstrained: false,
      },
      rawSections,
    };
  }

  // Sort: high-value first, then by score descending, then by document order
  // (stable sort preserves original order for equal-score sections).
  const sorted = [...sections]
    .map((s, idx) => ({ ...s, idx }))
    .sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      if (a.priority === "low" && b.priority !== "low") return 1;
      if (b.priority === "low" && a.priority !== "low") return -1;
      return b.score - a.score || a.idx - b.idx;
    });

  const selected: typeof sorted = [];
  let usedChars = 0;

  for (const section of sorted) {
    if (usedChars + section.charCount > charBudget) continue;
    selected.push(section);
    usedChars += section.charCount;
  }

  // Re-order selected sections by original document order for readability.
  selected.sort((a, b) => a.idx - b.idx);

  const outputParts = selected.map((s) =>
    s.heading !== "(preamble)" ? `${s.heading}\n${s.body}` : s.body,
  );

  const extractedText = outputParts.join("\n\n");
  const reductionPct =
    originalChars > 0
      ? Math.round(((originalChars - extractedText.length) / originalChars) * 100)
      : 0;

  const rawSections: RawSection[] = selected.map((s) => ({
    heading: s.heading,
    body: s.body,
  }));

  return {
    text: extractedText,
    stats: {
      originalChars,
      sectionCount: sections.length,
      selectedSections: selected.length,
      extractedChars: extractedText.length,
      reductionPct,
      wasBudgetConstrained: true,
    },
    rawSections,
  };
}
