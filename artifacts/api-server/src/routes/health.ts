import { Router, type IRouter } from "express";

const router: IRouter = Router();

const startedAt = Date.now();
const commitSha = process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["GIT_COMMIT"] ?? "local";

/**
 * GET /api/health
 * GET /api/healthz  (alias — used by the frontend offline-detection banner)
 *
 * Both paths return liveness details. /health uses the simplified format
 * requested for deployment verification; /healthz preserves the richer
 * format used by the frontend hook.
 */
router.get("/health", (_req: any, res: any) => {
  return res.json({
    status: "ok",
    service: "IndiePact API",
    environment: process.env["NODE_ENV"] ?? "production",
  });
});

router.get("/healthz", (_req: any, res: any) => {
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

export default router;
