---
name: IndiePact billing architecture
description: NGN/kobo billing pipeline, pricing config, CORS, and admin bypass decisions
---

**Pricing config (subscription.ts):**
- `PLAN_PRICES` — single source of truth: `{ starter: { usd: 19 }, ... }`
- `USD_TO_NGN_RATE = 1500` — update this constant when exchange rate changes
- `calculatePaystackAmount(plan)` — formula: `usd × 1500 × 100` = kobo integer
- `PLAN_CODES_NGN` — Paystack recurring plan codes (NGN account)

**Admin bypass:**
- `BILLING_TEST_EMAIL = "emmanueltimothy972@gmail.com"` — skips downgrade check in initialize route only
- `ADMIN_EMAIL` (env var) — forces business plan in subscription reads (separate system)
- `SUPERUSER_EMAIL` (env var) — exempt from scan quota in scanTracking.ts

**Payload to Paystack:** `{ email, amount: kobo, currency: "NGN", plan: planCode, metadata: { userId, tierName, planKey, usdPrice } }`

**CORS:** `app.use(cors({ origin: process.env.APP_URL ?? "*" }))` — restricted in production, wildcard in dev.

**Webhook resolveUserId:** Primary path via `metadata.userId` (always set). Fallback via paginated `listUsers(page, perPage=1000)` for edge cases.

**Vercel deployment blocker fixed:** `vite.config.ts` no longer throws on missing PORT/BASE_PATH.
