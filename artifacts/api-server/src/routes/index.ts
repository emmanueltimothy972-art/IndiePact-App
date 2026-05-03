import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import scansRouter from "./scans.js";
import dashboardRouter from "./dashboard.js";
import chatRouter from "./chat.js";
import clausesRouter from "./clauses.js";
import extractRouter from "./extract.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(scansRouter);
router.use(dashboardRouter);
router.use(chatRouter);
router.use(clausesRouter);
router.use(extractRouter);

export default router;
