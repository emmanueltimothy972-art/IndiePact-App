/**
 * Vercel Serverless Function entry point — IndiePact API (frontend deployment)
 *
 * Vercel detects this file as a source function and compiles it with @vercel/node.
 * The Express app from the api-server workspace is exported as the default handler.
 *
 * Environment variables required (set in the Vercel frontend project):
 *   SUPABASE_URL               — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (server-only)
 *   SUPABASE_ANON_KEY          — Public anon key
 *   RESEND_API_KEY             — Resend API key
 *   APP_URL                    — Frontend origin, e.g. https://indiepact.pro
 *   OPENAI_API_KEY             — OpenAI secret key
 *   SESSION_SECRET             — Session signing secret
 */
import app from "../../api-server/src/app.js";

export default app;
