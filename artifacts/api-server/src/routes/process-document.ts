// ─── Process Document Route ───────────────────────────────────────────────────
//
// POST /api/process-document
//
// Dual-mode HTTP adapter around the 5-layer extraction-pipeline.ts.
//
// MODE A — Vercel Blob (production):
//   Body: application/json { blobUrl: string, filename: string }
//   The client uploaded directly to Vercel Blob CDN (bypassing the 4.5 MB
//   serverless body limit). This handler fetches the file from the blob URL,
//   runs the pipeline, then deletes the blob immediately after.
//   The blob URL is a short-lived signed URL — it is only accessible to our
//   server for the duration of the request.
//
// MODE B — Direct multipart (Replit dev / fallback):
//   Body: multipart/form-data { file: <binary> }
//   Standard multer memory upload. Works because Replit runs a persistent
//   Express server (not serverless), so the 4.5 MB platform limit doesn't apply.
//   Also used as a resilience fallback if blob upload fails on the client.
//
// MODE DETECTION:
//   Automatic — checks req.body.blobUrl (set by express.json()) vs multer file.
//   No explicit header or mode flag required.
//
// MEMORY SAFETY:
//   Blob mode: file is never in request body — only a ~100 byte JSON reference.
//   The buffer is fetched server-side in one chunk. For 500-page contracts
//   (~5 MB of raw bytes) this is fine; the pipeline compresses to ~40 k chars.
//
// VERCEL NOTE:
//   /api/process-document in blob mode handles only tiny JSON payloads.
//   The recommended vercel.json settings (60s timeout, 1024 MB memory) are
//   for pipeline processing time and PDF decompression, not upload size.

import { Router } from "express";
// multer 2 ships no @types — import as any.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const multer = require("multer") as any;
import { requireAuth } from "../middleware/requireAuth.js";
import { runExtractionPipeline } from "../lib/extraction-pipeline.js";

const router = Router();

// ─── Multer (direct multipart mode) ──────────────────────────────────────────

const MULTER_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/rtf",
  "application/rtf",
  "application/x-rtf",
  "text/richtext",
  "application/octet-stream",
]);

const ACCEPTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt", ".rtf"]);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MULTER_LIMIT_BYTES },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileFilter(_req: any, file: any, cb: any) {
    const ext = getExtension(file.originalname);
    if (ACCEPTED_MIMES.has(file.mimetype) || ACCEPTED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type "${ext || file.mimetype}". ` +
            "Please upload a PDF, Word document (.docx), plain text (.txt), or RTF file.",
        ),
      );
    }
  },
});

// ─── Shared response builder ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBuffer(buffer: Buffer, mime: string, filename: string, req: any, res: any) {
  req.log.info(
    {
      userId: req.userId,
      mime,
      ext: getExtension(filename),
      sizeBytes: buffer.length,
      sizeMb: (buffer.length / 1_048_576).toFixed(2),
      event: "document_processing_start",
    },
    "Starting extraction pipeline",
  );

  const result = await runExtractionPipeline(buffer, mime, filename, req.log);

  if (result.status === "failed") {
    req.log.warn(
      { userId: req.userId, failureReason: result.failureReason, event: "document_failed" },
      `Document failed: ${result.failureReason}`,
    );
    const statusCode = result.failureReason === "unsupported_format" ? 400 : 422;
    return res.status(statusCode).json({
      error: result.failureMessage ?? "We couldn't process this document. Please try another file or paste the contract text directly.",
      format: result.format,
      failureReason: result.failureReason,
    });
  }

  if (result.status === "partial_success" && !result.text) {
    req.log.warn(
      { userId: req.userId, format: result.format, confidence: result.confidenceScore, event: "insufficient_text" },
      "Insufficient text after pipeline",
    );
    return res.status(422).json({
      error: result.failureMessage ?? "This document appears to be a scanned image without extractable text. For best results, please export a text-based PDF or paste the contract text directly.",
      format: result.format,
      requiresOcr: true,
      fallbackUsed: result.fallbackUsed,
    });
  }

  req.log.info(
    {
      userId: req.userId,
      event: "document_ready",
      status: result.status,
      charCount: result.charCount,
      estimatedTokens: result.telemetry.estimatedTokens,
      tokenReductionPct: result.telemetry.tokenReductionPct,
    },
    `Document ready — ${result.charCount} chars, ~${result.telemetry.estimatedTokens} tokens`,
  );

  return res.json({
    extractedText: result.text,
    charCount: result.charCount,
    wordCount: result.wordCount,
    format: result.format,
    fileName: filename,
    processingNotes: result.processingNotes,
    extractionConfidence: result.confidenceScore,
    extractionMethod: result.extractionMethod,
    fallbackUsed: result.fallbackUsed,
  });
}

// ─── Trusted blob URL validation ─────────────────────────────────────────────
// Only allow fetching from known Vercel Blob storage hostnames.
// This prevents SSRF: a client-supplied URL is never fetched without this check.

const TRUSTED_BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

function isTrustedBlobUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host.endsWith(TRUSTED_BLOB_HOST_SUFFIX);
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/process-document",
  requireAuth,
  async (req, res, next) => {
    // ── MODE A: Vercel Blob (JSON body with blobUrl) ──────────────────────────
    const blobUrl = (req.body as Record<string, unknown>)?.blobUrl;
    const filename = String((req.body as Record<string, unknown>)?.filename ?? "document");

    if (typeof blobUrl === "string" && isTrustedBlobUrl(blobUrl)) {
      const startMs = Date.now();
      req.log.info(
        { userId: req.userId, blobUrl, filename, event: "blob_download_start" },
        "Downloading file from Vercel Blob",
      );

      try {
        // Type as globalThis.Response (DOM Fetch API) to prevent collision with
        // Express's `Response` type in TypeScript environments where the name
        // `Response` is ambiguous. `lib: ["es2022", "dom"]` in api/tsconfig.json
        // guarantees globalThis.Response = DOM Fetch Response.
        const upstreamResponse: globalThis.Response = await fetch(blobUrl, {
          headers: { "User-Agent": "IndiePact/1.0 document-processor" },
        });

        if (!upstreamResponse.ok) {
          req.log.error(
            { blobUrl, status: upstreamResponse.status, event: "blob_download_failed" },
            `Blob download failed with HTTP ${upstreamResponse.status}`,
          );
          return res.status(502).json({
            error: "We encountered an issue retrieving your document from upload storage. Please try uploading again.",
          });
        }

        const arrayBuffer = await upstreamResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = upstreamResponse.headers.get("content-type") ?? "application/octet-stream";

        req.log.info(
          {
            userId: req.userId,
            blobUrl,
            sizeBytes: buffer.length,
            downloadMs: Date.now() - startMs,
            event: "blob_download_complete",
          },
          `Blob downloaded in ${Date.now() - startMs}ms`,
        );

        // Process the buffer through the pipeline
        await processBuffer(buffer, mime, filename, req, res);

        // Delete blob after successful processing (fire-and-forget — never blocks response)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          import("@vercel/blob")
            .then(({ del }) => del(blobUrl))
            .then(() => req.log.info({ blobUrl, event: "blob_deleted" }, "Blob deleted after processing"))
            .catch((err: unknown) =>
              req.log.warn({ err, blobUrl, event: "blob_delete_failed" }, "Failed to delete blob"),
            );
        }

        return; // res already sent by processBuffer
      } catch (err) {
        req.log.error({ err, blobUrl, event: "blob_mode_error" }, "Blob mode processing error");
        return res.status(500).json({
          error: "We encountered an issue processing this document. Please try again or paste the contract text directly.",
        });
      }
    }

    // ── MODE B: Direct multipart upload ──────────────────────────────────────
    // Hand off to multer middleware, then process the file buffer.
    upload.single("file")(req, res, async (multerErr: unknown) => {
      if (multerErr) {
        const message = multerErr instanceof Error ? multerErr.message : "Upload error";
        return res.status(400).json({ error: message });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (req as any).file as
        | { buffer: Buffer; mimetype: string; originalname: string; size: number }
        | undefined;

      if (!file) {
        return res.status(400).json({
          error: "No file received. Please select a document and try again.",
        });
      }

      try {
        await processBuffer(file.buffer, file.mimetype, file.originalname, req, res);
        return; // res already sent by processBuffer
      } catch (err) {
        req.log.error({ err, event: "direct_mode_error" }, "Direct mode processing error");
        return res.status(500).json({
          error: "We encountered an issue processing this document. Please try again or paste the contract text directly.",
        });
      }
    });

    void next; // suppress unused-variable warning
    return; // response is sent from within the multer callback above
  },
);

export default router;
