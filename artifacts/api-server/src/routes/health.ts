import { Router, type IRouter } from "express";

const router: IRouter = Router();

const startedAt = Date.now();
const commitSha = process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["GIT_COMMIT"] ?? "local";

router.get("/healthz", (_req: any, res: any) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  return res.json({
    status: "ok",
    commit: commitSha.slice(0, 7),
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
