import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import scansRouter from "./scans.js";
import dashboardRouter from "./dashboard.js";
import chatRouter from "./chat.js";
import clausesRouter from "./clauses.js";
import extractRouter from "./extract.js";
import legalStrategyRouter from "./legal-strategy.js";
import subscriptionRouter from "./subscription.js";
import webhookRouter from "./webhook.js";
import authRouter from "./auth.js";
import processDocumentRouter from "./process-document.js";
import uploadTokenRouter from "./upload-token.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(analyzeRouter);
router.use(scansRouter);
router.use(dashboardRouter);
router.use(chatRouter);
router.use(clausesRouter);
router.use(extractRouter);
router.use(legalStrategyRouter);
router.use(subscriptionRouter);
router.use(webhookRouter);
router.use(processDocumentRouter);
router.use(uploadTokenRouter);

export default router;
