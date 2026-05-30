import { createHash } from "crypto";

/**
 * Produces a stable SHA-256 fingerprint of a contract's text content.
 *
 * Normalization rules (order matters):
 *   1. Trim leading/trailing whitespace
 *   2. Collapse all internal whitespace runs to a single space
 *   3. Lowercase — so "CONTRACT" and "contract" produce the same hash
 *
 * Changing these rules will invalidate all previously stored hashes.
 * If you ever need to change them, write a background job to recompute
 * the hash column for existing rows.
 */
export function hashContractText(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
