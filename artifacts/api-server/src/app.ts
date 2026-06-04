import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
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

app.use("/api", router);

export default app;
