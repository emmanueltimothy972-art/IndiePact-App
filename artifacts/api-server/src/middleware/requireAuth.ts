import type { Request, Response as ExpressResponse, NextFunction } from "express";
import { requireSupabase } from "../lib/supabase.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string | undefined;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: ExpressResponse,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const supabase = requireSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res
        .status(401)
        .json({ error: "Invalid or expired session. Please sign in again." });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;
    return void next();
  } catch {
    res.status(503).json({ error: "Authentication service unavailable." });
    return;
  }
}
