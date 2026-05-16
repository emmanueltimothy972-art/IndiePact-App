import { rateLimit, Options, ipKeyGenerator } from "express-rate-limit";

/**
 * Rate limiter for the /api/analyze route.
 *
 * Limits:  10 requests per 60-second window per user.
 * Key:     userId from the (already-parsed) JSON body → falls back to IP.
 *
 * Why userId and not IP?
 *   The API is called server-to-server from the Replit preview proxy, so every
 *   request arrives from the same edge IP.  Keying on IP would rate-limit ALL
 *   users together.  Using userId isolates each account correctly.
 *
 * Cache hits still count toward the limit (they're cheap, but the limiter
 * defends against DoS regardless of whether OpenAI is actually called).
 */
export const ANALYZE_WINDOW_MS = 60_000; // 1 minute
export const ANALYZE_MAX_REQUESTS = 10;  // per user per window

const analyzeRateLimiterOptions: Partial<Options> = {
  windowMs: ANALYZE_WINDOW_MS,
  limit: ANALYZE_MAX_REQUESTS,

  // Key on userId from parsed body; fall back to the library's IPv6-safe IP helper
  keyGenerator: (req): string => {
    const userId = (req.body as Record<string, unknown>)?.["userId"];
    if (typeof userId === "string" && userId.trim()) return userId.trim();
    return ipKeyGenerator(req);
  },

  // Emit modern RateLimit-* headers (RFC draft-7), suppress legacy X-RateLimit-*
  standardHeaders: "draft-7",
  legacyHeaders: false,

  // Skip successful responses from the count — only failed/blocked requests
  // count once the limiter fires.  Express-rate-limit counts all requests by
  // default; we leave that default intact to keep accounting simple.
  skipSuccessfulRequests: false,

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
