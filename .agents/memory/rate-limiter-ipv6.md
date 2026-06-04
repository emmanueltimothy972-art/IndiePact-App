---
name: express-rate-limit IPv6 ipKeyGenerator
description: Must use ipKeyGenerator helper from express-rate-limit for IP fallback, not req.ip directly
---

`express-rate-limit` v8 throws `ERR_ERL_KEY_GEN_IPV6` at startup if a custom keyGenerator uses `req.ip` directly without calling their `ipKeyGenerator` helper.

**Fix:** Import `ipKeyGenerator` from `express-rate-limit` and call it with `ipKeyGenerator(req as any)` for the fallback branch.

**Why:** The library validates on startup that IPv6 addresses are handled safely. Their helper normalises IPv6 correctly. Using `req.ip` directly bypasses this normalisation.

**How to apply:** In any custom `keyGenerator`, the non-token fallback MUST use `ipKeyGenerator(req as any)` — the `as any` is needed because express-rate-limit's Request type diverges from Express's Request type in strict TypeScript.
