
import { Router, type IRouter } from "express";
import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "../config/firebase";

// Routes
import healthRouter from "./health.js";
import contractsRouter from "./contracts.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";

const router: IRouter = Router();

// Public routes
router.use("/health", healthRouter);

// Protected routes middleware
router.use(async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized - Malformed token" });
    }

    const decodedToken = await getAuth(firebaseApp as any).verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
});

// Protected routes
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/contracts", contractsRouter);

export default router;
