// ─── Document Normalizer ──────────────────────────────────────────────────────
//
// Converts raw parser output into clean, analysis-ready text.
// Handles: RTF markup, encoding artifacts, whitespace, header/footer noise.
// All operations are in-memory; no filesystem or external dependencies.

// ─── RTF Stripper ─────────────────────────────────────────────────────────────
// Full RTF control-word parser that respects nested groups and ignorable
// destinations (\*\...). Converts \par → \n, \tab → \t, handles \'xx hex
// escapes, and named special chars (endash, emdash, etc.).

function stripRtf(input: string): string {
  const out: string[] = [];
  let depth = 0;
  let ignoreDepth = 0;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch === "{") {
      depth++;
      i++;
      // Ignorable destination: {\*\ ...}
      if (input[i] === "\\" && input[i + 1] === "*" && input[i + 2] === "\\") {
        ignoreDepth = depth;
        i += 3;
      }
      continue;
    }

    if (ch === "}") {
      if (ignoreDepth === depth) ignoreDepth = 0;
      depth--;
      i++;
      continue;
    }

    const inIgnore = ignoreDepth > 0 && depth >= ignoreDepth;

    if (ch === "\\") {
      i++;
      if (i >= n) break;
      const next = input[i];

      // Hex-encoded byte: \'xx
      if (next === "'" && i + 2 < n) {
        if (!inIgnore) {
          const hex = input.slice(i + 1, i + 3);
          const code = parseInt(hex, 16);
          if (!isNaN(code)) {
            // Best-effort Windows-1252 → Unicode for common legal chars
            if (code >= 0x20 && code < 0x80) {
              out.push(String.fromCharCode(code));
            } else if (code === 0x91 || code === 0x92) {
              out.push("'");
            } else if (code === 0x93 || code === 0x94) {
              out.push('"');
            } else if (code === 0x96) {
              out.push("–");
            } else if (code === 0x97) {
              out.push("—");
            } else if (code > 0x7f) {
              try { out.push(Buffer.from([code]).toString("latin1")); } catch { /* skip */ }
            }
          }
        }
        i += 3;
        continue;
      }

      // Escaped literal: \\ \{ \}
      if (next === "\\" || next === "{" || next === "}") {
        if (!inIgnore) out.push(next);
        i++;
        continue;
      }

      // Control word: [a-zA-Z]+[-]?[0-9]*[ ]?
      if (/[a-zA-Z]/.test(next)) {
        let word = "";
        while (i < n && /[a-zA-Z]/.test(input[i])) word += input[i++];
        let param = "";
        if (i < n && (input[i] === "-" || /\d/.test(input[i]))) {
          if (input[i] === "-") { param += "-"; i++; }
          while (i < n && /\d/.test(input[i])) param += input[i++];
        }
        if (i < n && input[i] === " ") i++; // consume space delimiter

        if (!inIgnore) {
          if (word === "par" || word === "pard" || word === "page" || word === "line" || word === "sect") {
            out.push("\n");
          } else if (word === "tab") {
            out.push("\t");
          } else if (word === "endash") {
            out.push("–");
          } else if (word === "emdash") {
            out.push("—");
          } else if (word === "lquote" || word === "rquote") {
            out.push("'");
          } else if (word === "ldblquote" || word === "rdblquote") {
            out.push('"');
          } else if (word === "bullet") {
            out.push("•");
          }
          // All other control words (formatting, font size, etc.) are silently consumed
        }
        void param; // may be used for future numeric parsing
        continue;
      }

      // Control symbol (non-alpha after \) — skip
      i++;
      continue;
    }

    if (!inIgnore) out.push(ch);
    i++;
  }

  return out.join("");
}

// ─── Encoding artifact repair ──────────────────────────────────────────────────
// Repairs the most common multi-byte UTF-8 sequences that get mis-decoded
// as Latin-1 by broken PDF extractors, plus normalises typographic punctuation.

function fixEncodingArtifacts(text: string): string {
  return text
    // Mojibake sequences for curly apostrophe / quotes / dashes
    .replace(/\u00e2\u0080\u0099/g, "'")
    .replace(/\u00e2\u0080\u009c/g, '"')
    .replace(/\u00e2\u0080\u009d/g, '"')
    .replace(/\u00e2\u0080\u0093/g, "–")
    .replace(/\u00e2\u0080\u0094/g, "—")
    // Normalise typographic punctuation to plain ASCII equivalents so keyword
    // matching in prefilter.ts and legal-section-extractor.ts works uniformly
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    // Remove zero-width chars and BOM
    .replace(/[\ufeff\u200b\u200c\u200d\u00ad]/g, "");
}

// ─── Header / footer noise removal ────────────────────────────────────────────

function removeHeaderFooterNoise(lines: string[]): string[] {
  return lines.filter((line) => {
    const t = line.trim();
    // Lone page numbers
    if (/^\d{1,4}$/.test(t)) return false;
    // "Page X of Y" or "- X -"
    if (/^[-–]?\s*\d+\s*[-–]?$/.test(t)) return false;
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t)) return false;
    // Pure divider lines
    if (/^[-_=*~]{3,}$/.test(t)) return false;
    return true;
  });
}

// ─── Whitespace normaliser ─────────────────────────────────────────────────────

function normaliseWhitespace(text: string): string {
  return (
    text
      // Normalise line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Convert form feeds / vertical tabs to paragraph breaks
      .replace(/[\f\v]/g, "\n\n")
      // Trim trailing whitespace on every line
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      // Collapse 3+ blank lines to exactly 2 (one paragraph break)
      .replace(/\n{3,}/g, "\n\n")
      // Collapse multiple spaces within a line
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NormalisationResult {
  text: string;
  wasRtf: boolean;
}

/**
 * Takes raw parser output and returns clean, analysis-ready text.
 *
 * Steps:
 *  1. Detect & strip RTF markup if present.
 *  2. Apply NFKC Unicode normalisation.
 *  3. Repair encoding artifacts (mojibake, smart-quote mis-decoding).
 *  4. Remove control characters, null bytes, and BOMs.
 *  5. Strip header/footer noise lines.
 *  6. Normalise whitespace while preserving paragraph structure.
 */
export function normaliseDocument(rawText: string, format: string): NormalisationResult {
  let text = rawText;
  let wasRtf = false;

  // ── RTF ─────────────────────────────────────────────────────────────────────
  if (format === "rtf" || text.trimStart().startsWith("{\\rtf")) {
    text = stripRtf(text);
    wasRtf = true;
  }

  // ── Unicode normalisation ────────────────────────────────────────────────────
  text = text.normalize("NFKC");

  // ── Encoding repair ──────────────────────────────────────────────────────────
  text = fixEncodingArtifacts(text);

  // ── Remove non-printable control chars (keep \t \n) ─────────────────────────
  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");

  // ── Header/footer noise ──────────────────────────────────────────────────────
  const lines = text.split("\n");
  const cleanedLines = removeHeaderFooterNoise(lines);

  // ── Whitespace ───────────────────────────────────────────────────────────────
  text = normaliseWhitespace(cleanedLines.join("\n"));

  return { text, wasRtf };
}
