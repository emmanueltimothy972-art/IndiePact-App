// ─── Upload Token Route ────────────────────────────────────────────────────────
//
// POST /api/upload-token
// GET  /api/upload-config
//
// Vercel Blob client-side upload infrastructure.
//
// ARCHITECTURE:
//   Large files (up to 50 MB+) bypass Vercel's 4.5 MB serverless body limit
//   by uploading DIRECTLY from the browser to Vercel Blob CDN.
//   This route serves two purposes:
//
//   1. GET /api/upload-config — tells the frontend which upload mode to use:
//      { mode: "blob" }    when BLOB_READ_WRITE_TOKEN is configured (production)
//      { mode: "direct" }  when it is not (Replit dev — uses multipart fallback)
//
//   2. POST /api/upload-token — Vercel Blob SDK authorization callback.
//      Called TWICE by the SDK during client upload:
//        Phase 1: Generate a short-lived client token (browser → Vercel Blob CDN)
//        Phase 2: Upload-completed notification (Vercel infra → this server)
//
// SECURITY:
//   - requireAuth ensures only logged-in users can initiate uploads
//   - onBeforeGenerateToken validates content type and sets a 50 MB ceiling
//   - tokenPayload carries userId so it can be retrieved on completion
//
// SETUP (Vercel):
//   1. Enable Vercel Blob storage in your project dashboard
//   2. Set BLOB_READ_WRITE_TOKEN as an environment variable on Vercel
//   3. The frontend automatically detects the mode from /api/upload-config
//
// DEV FALLBACK:
//   Without BLOB_READ_WRITE_TOKEN the frontend falls back to direct multipart
//   upload — existing behaviour, works fine in Replit where Express is a real
//   long-running server (not serverless).

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// ─── Allowed MIME types for blob uploads ──────────────────────────────────────

const BLOB_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/rtf",
  "text/rtf",
  "application/x-rtf",
  "text/richtext",
  "application/octet-stream", // Chrome / Safari browser quirk for PDF / DOCX
];

const BLOB_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ─── GET /api/upload-config ───────────────────────────────────────────────────

router.get("/upload-config", requireAuth, (_req, res) => {
  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return res.json({
    mode: blobConfigured ? "blob" : "direct",
    maxSizeBytes: BLOB_MAX_SIZE_BYTES,
  });
});

// ─── POST /api/upload-token ───────────────────────────────────────────────────
// Called by @vercel/blob/client's upload() SDK during client-side upload.
// Handles both the token-generation phase and the upload-completed phase.

router.post("/upload-token", requireAuth, async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: "Vercel Blob is not configured on this server.",
      mode: "direct",
    });
  }

  try {
    const { handleUpload } = await import("@vercel/blob/client");

    // Construct a minimal Web API Request from the Express request
    // (handleUpload requires a Request, not an IncomingMessage)
    const protocol = process.env.NODE_ENV === "production" ? "https" : (req.protocol || "https");
    const host = req.get("host") ?? "localhost";
    const webRequestUrl = `${protocol}://${host}${req.originalUrl}`;

    const headerEntries: [string, string][] = [];
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headerEntries.push([key, value]);
      else if (Array.isArray(value)) headerEntries.push([key, value.join(", ")]);
    }

    const webRequest = new Request(webRequestUrl, {
      method: "POST",
      headers: new Headers(headerEntries),
      body: JSON.stringify(req.body),
    });

    const responseBody = await handleUpload({
      body: req.body as Parameters<typeof handleUpload>[0]["body"],
      request: webRequest,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate and return token configuration
        void pathname;
        void clientPayload;
        return {
          allowedContentTypes: BLOB_ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: BLOB_MAX_SIZE_BYTES,
          // Embed userId in token so we can retrieve it on completion
          tokenPayload: JSON.stringify({ userId: req.userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called by Vercel Blob infrastructure when upload finishes.
        // Useful for audit logging — actual processing happens when the
        // client sends the blobUrl to /api/process-document.
        let userId = "unknown";
        try {
          const payload = JSON.parse(tokenPayload ?? "{}") as { userId?: string };
          userId = payload.userId ?? "unknown";
        } catch {
          /* ignore parse errors */
        }
        req.log.info(
          {
            event: "blob_upload_completed",
            userId,
            blobUrl: blob.url,
            blobSize: (blob as unknown as Record<string, unknown>)["size"] as number | undefined,
            blobContentType: blob.contentType,
          },
          `Blob upload completed: ${blob.url}`,
        );
      },
    });

    return res.json(responseBody);
  } catch (err) {
    req.log.error(
      { err, event: "upload_token_error", userId: req.userId },
      "Failed to handle blob upload token request",
    );
    return res.status(500).json({
      error: "Failed to process upload request. Please try again.",
    });
  }
});

export default router;
