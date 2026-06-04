---
name: Supabase PromiseLike chain
description: Supabase client query builders return PromiseLike, not Promise — .catch() is unavailable
---

Supabase query builders (`.from().update().eq()`) return `PromiseLike<T>`, not a real `Promise<T>`. PromiseLike only has `.then()` — no `.catch()` or `.finally()`.

**Fix:** Wrap in `Promise.resolve(supabaseQuery).catch(() => {})` for fire-and-forget calls.

**Why:** TypeScript correctly rejects `.catch()` on `PromiseLike`. The runtime also rejects it because the Supabase client's thenable doesn't implement `.catch`.

**How to apply:** Any fire-and-forget Supabase call must use `void Promise.resolve(db.from(...).update(...).eq(...)).catch(() => {})`.
