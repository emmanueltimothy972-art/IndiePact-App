import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// ─── Raw body capture ─────────────────────────────────────────────────────────
// Paystack (and most payment gateways) require HMAC verification over the
// EXACT raw request bytes — not re-serialized JSON. Re-serializing a parsed
// object can alter whitespace or key ordering, breaking the signature check.
//
// The verify callback runs BEFORE express.json() stores the parsed body,
// giving us access to the unmodified Buffer. We attach it to req.rawBody so
// webhook handlers can use it for signature verification without changing the
// rest of the middleware stack.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Unmodified raw request body Buffer — set for all requests by the
       *  express.json() verify callback. Used by Paystack HMAC verification. */
      rawBody?: Buffer;
    }
  }
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS — restrict to the configured frontend origin in production.
// APP_URL is set in the environment (e.g. https://indiepact.com).
// Falls back to "*" when not set (Replit dev / local environments).
const allowedOrigin = process.env["APP_URL"]
  ? process.env["APP_URL"].replace(/\/$/, "")
  : "*";
app.use(cors({ origin: allowedOrigin }));
app.use(
  express.json({
    verify: (_req, _res, buf) => {
      // Attach the raw body buffer to every request.
      // Overhead is negligible; only the webhook route uses it.
      (_req as Express.Request).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// ─── Top-level health endpoint ────────────────────────────────────────────────
// Accessible directly at https://<api-domain>/health (no /api prefix).
// Used for deployment verification and uptime monitors.
// Also mirrored under /api/health (in routes/health.ts) for frontend use.
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "IndiePact API",
    environment: process.env["NODE_ENV"] ?? "production",
  });
});

app.use("/api", router);

// ─── 404 handler ──────────────────────────────────────────────────────────────
// Catches every request that didn't match a registered route and returns JSON
// instead of Express's default HTML page — keeps the API surface consistent.
app.use((_req, res) => {
  return res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Express 5 automatically forwards async-handler throws to next(err).
// Without this, those errors fall through to Express's default HTML error page.
// The headersSent guard prevents a double-send when errors occur mid-stream.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: unknown }).status) || 500
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal server error";
    logger.error({ err, status, event: "unhandled_route_error" }, message);
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  },
);

export default app;
