---
name: ESM require on Vercel
description: Bare require() throws ReferenceError at module load time on Vercel when package.json has "type":"module"; use createRequire(import.meta.url) instead.
---

## Rule
Never use bare `require()` at module level in this codebase. Always use `createRequire(import.meta.url)("pkg")`.

**Why:** `package.json` has `"type": "module"`. `@vercel/node` respects this and outputs ESM. In ESM, `require` is not a global. The local `build.mjs` injects `globalThis.require` via esbuild's `banner` option — Vercel does NOT apply this banner. A bare `require()` at module load time silently worked in dev but caused `FUNCTION_INVOCATION_FAILED` on every Vercel request.

**How to apply:**
```typescript
import { createRequire } from "node:module";
const multer = createRequire(import.meta.url)("multer") as any;
```

Use this pattern for any CJS-only package that has no native ESM export (e.g. multer, which ships no `@types` and no ESM entry).
