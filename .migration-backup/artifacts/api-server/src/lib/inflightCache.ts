/**
 * In-flight request deduplication cache.
 *
 * ── Purpose ──────────────────────────────────────────────────────────────────
 * Prevents duplicate OpenAI calls when the same user submits the same contract
 * text twice before the first request's DB save completes (race window).
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * Module-level singleton. On stateless/serverless platforms (Vercel, Replit),
 * each function instance has isolated module memory. This cache deduplicates
 * SIMULTANEOUS identical requests within the SAME instance.
 *
 * Cross-instance duplicates (two requests hitting different cold-start
 * instances at the same moment) are handled downstream by the DB-level
 * UNIQUE constraint + ON CONFLICT logic in scans.ts.
 *
 * ── Memory safety ────────────────────────────────────────────────────────────
 * Every entry is cleaned up in two ways:
 *   1. The caller's finally block (fast path, normal operation).
 *   2. A hard per-entry timeout (60s default) that fires even if the caller's
 *      finally never runs (e.g. unhandled process crash or stuck promise).
 *
 * ── Isolation ────────────────────────────────────────────────────────────────
 * Keys must be namespaced by userId so users never share in-flight results.
 * The caller is responsible for constructing keys as `${userId}:${hash}`.
 *
 * ── Fallback ─────────────────────────────────────────────────────────────────
 * If the awaited promise rejects (original AI call failed), the waiting
 * request catches the rejection and falls through to make its own independent
 * AI call. No result is silently swallowed.
 */

interface CacheEntry<T> {
  promise: Promise<T>;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class InflightCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();
  private readonly timeoutMs: number;

  constructor(timeoutMs = 60_000) {
    this.timeoutMs = timeoutMs;
  }

  get(key: string): Promise<T> | undefined {
    return this.map.get(key)?.promise;
  }

  set(key: string, promise: Promise<T>): void {
    // Clear any stale entry for this key before setting a new one
    const existing = this.map.get(key);
    if (existing) clearTimeout(existing.timeoutId);

    const timeoutId = setTimeout(() => {
      this.map.delete(key);
    }, this.timeoutMs);

    this.map.set(key, { promise, timeoutId });
  }

  delete(key: string): void {
    const entry = this.map.get(key);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.map.delete(key);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

// Singleton for contract analysis requests.
// Key format: `${userId}:${contractHash}` — always user-scoped.
export const analysisCache = new InflightCache<Record<string, unknown>>();
