/**
 * ResultCache — in-memory TTL cache for deterministic AI results.
 *
 * Unlike InflightCache (which deduplicates simultaneous in-flight requests),
 * ResultCache persists completed results and serves them for subsequent
 * requests within the TTL window — eliminating repeated OpenAI calls when
 * the same input would produce the same output.
 *
 * Designed for:
 *   - Legal Strategy results (same scanId → same AI output)
 *   - Any call where inputs are deterministic and user-scoped
 *
 * Keys MUST be namespaced by userId. Never share results across users.
 *
 * Memory safety:
 *   - Each entry auto-expires via clearTimeout after TTL.
 *   - If the cache reaches MAX_ENTRIES, the oldest entry is evicted (LRU-lite).
 *
 * Limitations:
 *   - Module-level singleton — isolated per process instance.
 *   - Does not persist across server restarts.
 *   - For cross-instance caching, use the DB (scans table strategy_result column).
 */

interface CacheEntry<T> {
  value: T;
  timeoutId: ReturnType<typeof setTimeout>;
  insertedAt: number;
}

export class ResultCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  /**
   * @param ttlMs      How long each entry lives (default: 30 minutes)
   * @param maxEntries Maximum entries before oldest is evicted (default: 500)
   */
  constructor(ttlMs = 30 * 60 * 1000, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: T): void {
    // Evict oldest entry if at capacity
    if (this.map.size >= this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, entry] of this.map.entries()) {
        if (entry.insertedAt < oldestTs) {
          oldestTs = entry.insertedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.delete(oldestKey);
    }

    // Clear any existing entry so TTL resets
    const existing = this.map.get(key);
    if (existing) clearTimeout(existing.timeoutId);

    const timeoutId = setTimeout(() => {
      this.map.delete(key);
    }, this.ttlMs);

    this.map.set(key, { value, timeoutId, insertedAt: Date.now() });
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

// ─── Singleton caches ─────────────────────────────────────────────────────────

import type { LegalStrategyResult } from "./openai.js";

/**
 * Caches legal strategy results keyed by `${userId}:${scanId}`.
 * TTL: 30 minutes. Eliminates repeat OpenAI calls when user revisits
 * the Legal Strategy page for the same contract.
 */
export const strategyCache = new ResultCache<LegalStrategyResult>(30 * 60 * 1000, 200);
