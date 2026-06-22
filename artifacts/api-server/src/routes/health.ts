import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const startedAt = Date.now();
const commitSha = process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["GIT_COMMIT"] ?? "local";

/**
 * GET /api/ping
 * Minimal smoke-test — no database, no auth, no external services.
 * First route verified after a deployment to prove the function is alive.
 */
router.get("/ping", (_req: Request, res: Response) => {
  return res.json({ status: "alive" });
});

/**
 * GET /api/health
 * GET /api/healthz  (alias — used by the frontend offline-detection banner)
 *
 * Both paths return liveness details. /health uses the simplified format
 * requested for deployment verification; /healthz preserves the richer
 * format used by the frontend hook.
 */
router.get("/health", (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    service: "IndiePact API",
    environment: process.env["NODE_ENV"] ?? "production",
  });
});

router.get("/healthz", (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  return res.json({
    status: "ok",
    service: "IndiePact API",
    environment: process.env["NODE_ENV"] ?? "production",
    commit: commitSha.slice(0, 7),
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/debug/env
 * Returns which environment variables are present (true/false only — no values).
 * Used to diagnose OTP/email failures without exposing secrets.
 * Remove this endpoint once the production issue is resolved.
 */
router.get("/debug/env", (_req: Request, res: Response) => {
  return res.json({
    supabaseUrl:         !!process.env["SUPABASE_URL"],
    supabaseAnon:        !!process.env["SUPABASE_ANON_KEY"],
    supabaseServiceRole: !!process.env["SUPABASE_SERVICE_ROLE_KEY"],
    resendKey:           !!process.env["RESEND_API_KEY"],
    authFromEmail:       !!process.env["AUTH_FROM_EMAIL"],
    appUrl:              !!process.env["APP_URL"],
  });
});

export default router;
