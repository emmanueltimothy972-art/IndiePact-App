import { Router } from "express";

import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import authRouter from "./auth.js";
import chatRouter from "./chat.js";
import clausesRouter from "./clauses.js";
import dashboardRouter from "./dashboard.js";
import extractRouter from "./extract.js";
import legalStrategyRouter from "./legal-strategy.js";
import processDocumentRouter from "./process-document.js";
import scansRouter from "./scans.js";
import subscriptionRouter from "./subscription.js";
import uploadTokenRouter from "./upload-token.js";
import webhookRouter from "./webhook.js";

const router = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(clausesRouter);
router.use(dashboardRouter);
router.use(extractRouter);
router.use(legalStrategyRouter);
router.use(processDocumentRouter);
router.use(scansRouter);
router.use(subscriptionRouter);
router.use(uploadTokenRouter);
router.use(webhookRouter);

export default router;
