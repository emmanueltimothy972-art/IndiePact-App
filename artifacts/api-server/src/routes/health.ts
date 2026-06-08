import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req: any, res: any) => {
  res.json({ status: "ok" });
});

export default router;
