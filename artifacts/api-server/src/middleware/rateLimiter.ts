import { createHash } from "crypto";
import { rateLimit, Options, ipKeyGenerator } from "express-rate-limit";

/**
 * Rate limiter for the /api/analyze route.
 *
 * Limits:  10 requests per 60-second window per user.
 * Key:     SHA-256 of the Bearer token from the Authorization header.
 *          Falls back to the library's IP-safe helper for unauthenticated requests.
 *
 * ── Why token, not body userId? ──────────────────────────────────────────────
 * The previous implementation keyed on `req.body.userId`. This was vulnerable
 * to a spoofing attack: a malicious client could send another user's UUID in
 * the body to exhaust that user's rate-limit bucket. The token is cryptographically
 * tied to the authenticated session — it cannot be spoofed without the Supabase
 * signing secret.
 *
 * ── Why not req.userId? ──────────────────────────────────────────────────────
 * requireAuth (which sets req.userId) runs AFTER the rate limiter in the
 * middleware chain. Parsing req.userId here would require a redundant Supabase
 * call before the rate limit is even enforced, defeating its purpose.
 * Hashing the raw token gives us a unique-per-session bucket that is both
 * fast (no network call) and secure (cryptographic binding to identity).
 *
 * ── Why SHA-256? ─────────────────────────────────────────────────────────────
 * We must never store the raw token in memory (it acts as a bearer credential).
 * A SHA-256 hash is irreversible, compact (32 bytes), and trivially fast.
 * The first 32 hex characters are used as the rate-limit map key.
 *
 * ── Token refresh ────────────────────────────────────────────────────────────
 * If the user refreshes their Supabase session token within a rate-limit window,
 * they get a new bucket (rate limit counter resets). This is acceptable — it
 * cannot be exploited to bypass the scan quota gate, which is enforced separately
 * against the database in scanTracking.ts and keyed on the verified userId.
 */
export const ANALYZE_WINDOW_MS = 60_000; // 1 minute
export const ANALYZE_MAX_REQUESTS = 10;  // per token per window

const analyzeRateLimiterOptions: Partial<Options> = {
  windowMs: ANALYZE_WINDOW_MS,
  limit: ANALYZE_MAX_REQUESTS,

  keyGenerator: (req): string => {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.length > 10) {
        // Hash the full token — irreversible, compact, unique per session.
        return createHash("sha256").update(token).digest("hex").slice(0, 32);
      }
    }
    // Unauthenticated requests (missing or malformed token) fall back to IP.
    // All authenticated paths will have a Bearer token.
    return ipKeyGenerator(req);
  },

  // Emit modern RateLimit-* headers (RFC draft-7), suppress legacy X-RateLimit-*
  standardHeaders: "draft-7",
  legacyHeaders: false,

  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil((options.windowMs as number) / 1000);
    res.status(429).json({
      error: "Too many requests",
      message: `You've submitted too many contracts in a short window. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
    });
  },
};

export const analyzeRateLimiter = rateLimit(analyzeRateLimiterOptions);
