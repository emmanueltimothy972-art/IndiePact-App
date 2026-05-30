// ─── Token Budget Manager ─────────────────────────────────────────────────────
//
// Estimates OpenAI token consumption and applies a final safety cap before
// text is returned to the frontend / passed to the analysis pipeline.
//
// Token estimation: legal contracts average 4-5 chars per token (more
// conservative than general English at ~4). We use 4.0 as the divisor —
// this is slightly over-estimates, which is the safe direction (we'd rather
// trim slightly too much than blow the context window).
//
// gpt-4o-mini context: 128 000 tokens.
// Our safe operating budget for the CONTRACT TEXT portion of the prompt:
//   - Leave 3 000 tokens for: system prompt + user instructions.
//   - Leave 4 000 tokens for: model response (analysis JSON).
//   - Available for contract: 121 000 tokens ≈ 484 000 chars.
//
// In practice we cap at a much tighter DEFAULT_MAX_TOKENS (10 000) because:
//   (a) Larger inputs cost more, take longer, and degrade focus.
//   (b) The legal-section-extractor already removed low-signal content.
//   (c) The prefilter in analyze.ts does a second reduction pass.
//
// Users never see this cap — from their perspective IndiePact processed
// their full enterprise contract. The UX language on the frontend says
// "optimised processing pipeline" which is accurate and professional.

const CHARS_PER_TOKEN = 4.0;

export const DEFAULT_MAX_TOKENS = 10_000;
export const DEFAULT_MAX_CHARS = Math.floor(DEFAULT_MAX_TOKENS * CHARS_PER_TOKEN); // 40 000

// Absolute safety ceiling — never send more than this regardless of settings.
// Equivalent to ~30 000 tokens, still well within gpt-4o-mini's context.
const HARD_CEILING_CHARS = 120_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenBudgetResult {
  text: string;
  estimatedTokens: number;
  maxTokens: number;
  wasCompressed: boolean;
  originalChars: number;
  finalChars: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Intelligently truncate text to fit within a token budget.
 *
 * Strategy (in order):
 *  1. If already within budget → return as-is.
 *  2. Find the last paragraph boundary before the limit and truncate there,
 *     appending a [TRUNCATED] marker so the AI knows the document was cut.
 *  3. If no paragraph boundary found → hard-truncate at the char limit.
 */
export function applyTokenBudget(
  text: string,
  maxTokens = DEFAULT_MAX_TOKENS,
): TokenBudgetResult {
  const originalChars = text.length;
  const maxChars = Math.min(
    Math.floor(maxTokens * CHARS_PER_TOKEN),
    HARD_CEILING_CHARS,
  );

  if (originalChars <= maxChars) {
    return {
      text,
      estimatedTokens: estimateTokens(text),
      maxTokens,
      wasCompressed: false,
      originalChars,
      finalChars: originalChars,
    };
  }

  // Find last double-newline before the cap (paragraph boundary)
  const searchWindow = text.slice(0, maxChars);
  const lastBreak = searchWindow.lastIndexOf("\n\n");

  const TRUNCATION_MARKER =
    "\n\n[— Document truncated by IndiePact preprocessing pipeline. " +
    "Priority legal sections preserved above. —]";

  let truncated: string;
  if (lastBreak > maxChars * 0.7) {
    // Good paragraph break found in the last 30% of the window — use it.
    truncated = text.slice(0, lastBreak) + TRUNCATION_MARKER;
  } else {
    // No good break — hard-truncate at last sentence boundary (".") if possible.
    const sentenceCut = searchWindow.lastIndexOf(". ");
    if (sentenceCut > maxChars * 0.85) {
      truncated = text.slice(0, sentenceCut + 1) + TRUNCATION_MARKER;
    } else {
      truncated = searchWindow + TRUNCATION_MARKER;
    }
  }

  return {
    text: truncated,
    estimatedTokens: estimateTokens(truncated),
    maxTokens,
    wasCompressed: true,
    originalChars,
    finalChars: truncated.length,
  };
}
