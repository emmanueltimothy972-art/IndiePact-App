---
name: Vite build env guards
description: PORT and BASE_PATH must not throw during vite build — Vercel has no PORT at build time
---

The `vite.config.ts` used to throw `new Error` if PORT or BASE_PATH were missing.
This ran at module evaluation time, which includes `vite build`, crashing Vercel builds.

**Fix:** Use fallbacks: `const port = rawPort ? Number(rawPort) : 3000` and `const basePath = process.env.BASE_PATH ?? "/"`.

**Why:** `vite build` evaluates the config file but doesn't start a dev server, so PORT is irrelevant. Only `vite dev` needs PORT.

**How to apply:** Any time new env vars are added to vite.config.ts, use `?? fallback` instead of throwing.
