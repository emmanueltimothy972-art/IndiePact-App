/**
 * Vercel Serverless Function entry point — IndiePact API
 *
 * Vercel compiles this file with @vercel/node (esbuild) and invokes it as a
 * serverless function for every request that matches the rewrite in vercel.json.
 *
 * The Express app (src/app.ts) is exported as the default handler. Vercel's
 * Node.js runtime accepts an Express app directly because it satisfies the
 * (req, res) interface that @vercel/node expects.
 *
 * All routes remain under /api/* as configured in src/app.ts:
 *   app.use("/api", router)
 *
 * Environment variables required on the Vercel project:
 *   SUPABASE_URL               — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (server-only, never client)
 *   SUPABASE_ANON_KEY          — Public anon key (also used by Vite define)
 *   OPENAI_API_KEY             — OpenAI secret key
 *   PAYSTACK_SECRET_KEY        — Paystack secret key
 *   PAYSTACK_PUBLIC_KEY        — Paystack public key
 *   SESSION_SECRET             — Session signing secret
 *   APP_URL                    — Frontend origin for CORS (e.g. https://indiepact.pro)
 *   BLOB_READ_WRITE_TOKEN      — Vercel Blob token (enables client-side uploads)
 *   RESEND_API_KEY             — Resend API key (enables branded OTP emails)
 *   AUTH_FROM_EMAIL            — From address for OTP emails
 *   SUPABASE_WEBHOOK_SECRET    — HMAC secret for Supabase Auth Hook verification
 *   ADMIN_EMAIL                — Admin override email (optional)
 *   SUPERUSER_EMAIL            — Superuser bypass email (optional)
 */
import app from "../src/app.js";

export default app;
