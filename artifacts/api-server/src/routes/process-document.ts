// ─── Process Document Route ───────────────────────────────────────────────────
//
// POST /api/process-document
//
// Thin HTTP adapter around the 5-layer extraction-pipeline.ts.
// All parsing, normalisation, section extraction, and cost-optimisation logic
// lives in extraction-pipeline.ts — this file only handles:
//   • multipart/form-data reception (multer, memory-only, no disk)
//   • MIME + extension validation (including browser octet-stream quirk)
//   • Mapping PipelineResult → HTTP response
//   • Structured error states per spec
//
// Response shape (backwards-compatible with DocumentLab.tsx):
//   Success / partial_success → HTTP 200, { extractedText, charCount, wordCount,
//                                             format, fileName, processingNotes }
//   Failed                    → HTTP 4xx, { error, format?, failureReason? }
//
// Vercel note:
//   Default body limit on Vercel serverless is 4.5 MB. To support larger uploads
//   add a vercel.json route override:
//     { "functions": { "api/*.ts": { "maxDuration": 60, "memory": 1024 } } }
//   and set bodyParser: false on the route handler.
//   The multer limit here is the Node/Express ceiling; Vercel enforces its own
//   upstream limit independently.

import { Router } from "express";
// multer 2 ships no bundled @types — use require + any cast.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const multer = require("multer") as any;
import { requireAuth } from "../middleware/requireAuth.js";
import { runExtractionPipeline } from "../lib/extraction-pipeline.js";

const router = Router();

// ─── Multer configuration ─────────────────────────────────────────────────────
// 50 MB ceiling — comfortably handles 500-page enterprise contracts in memory.
// application/octet-stream is included because Chrome/Safari sometimes sends
// this MIME type for PDF/DOCX files opened from the local filesystem.

const MULTER_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword", // legacy .doc — accepted by multer, rejected in pipeline
  "text/plain",
  "text/rtf",
  "application/rtf",
  "application/x-rtf",
  "text/richtext",
  "application/octet-stream", // browser quirk — real format detected by magic bytes
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

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/process-document",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (req as any).file as
      | { buffer: Buffer; mimetype: string; originalname: string; size: number }
      | undefined;

    if (!file) {
      return res.status(400).json({
        error: "No file received. Please select a document and try again.",
      });
    }

    req.log.info(
      {
        userId: req.userId,
        mime: file.mimetype,
        ext: getExtension(file.originalname),
        sizeBytes: file.size,
        sizeMb: (file.size / 1_048_576).toFixed(2),
        event: "document_upload_received",
      },
      "Document upload received",
    );

    // ── Run 5-layer pipeline ──────────────────────────────────────────────────
    const result = await runExtractionPipeline(
      file.buffer,
      file.mimetype,
      file.originalname,
      req.log,
    );

    // ── Map pipeline result → HTTP response ──────────────────────────────────

    // Hard failure (corrupt file, unsupported format, password-protected PDF)
    if (result.status === "failed") {
      req.log.warn(
        {
          userId: req.userId,
          failureReason: result.failureReason,
          format: result.format,
          event: "document_failed",
        },
        `Document processing failed: ${result.failureReason}`,
      );

      const statusCode =
        result.failureReason === "unsupported_format" ? 400 : 422;

      return res.status(statusCode).json({
        error: result.failureMessage ?? "We couldn't process this document. Please try another file or paste the contract text directly.",
        format: result.format,
        failureReason: result.failureReason,
      });
    }

    // Partial success (scanned PDF / low-confidence extraction)
    // → HTTP 200 with fallback text + informative processing notes
    // The user sees "Processing complete" — never a restriction or error.
    if (result.status === "partial_success" && !result.text) {
      // No usable text even after fallback — tell user clearly but gently
      req.log.warn(
        {
          userId: req.userId,
          format: result.format,
          confidenceScore: result.confidenceScore,
          event: "document_insufficient_text",
        },
        "Document returned insufficient text after fallback",
      );
      return res.status(422).json({
        error:
          result.failureMessage ??
          "This document appears to be a scanned image without extractable text. " +
            "For best results, please export a text-based PDF, convert to Word (.docx), or paste the contract text directly.",
        format: result.format,
        requiresOcr: true,
        fallbackUsed: result.fallbackUsed,
      });
    }

    // Success or partial_success with text — always HTTP 200
    req.log.info(
      {
        userId: req.userId,
        event: "document_processed",
        status: result.status,
        telemetry: result.telemetry,
      },
      `Document ready — ${result.charCount} chars, ~${result.telemetry.estimatedTokens} tokens, ${result.telemetry.tokenReductionPct}% reduction`,
    );

    return res.json({
      extractedText: result.text,
      charCount: result.charCount,
      wordCount: result.wordCount,
      format: result.format,
      fileName: file.originalname,
      processingNotes: result.processingNotes,
      // Internal metadata (non-breaking additions — frontend ignores unknown fields)
      extractionConfidence: result.confidenceScore,
      extractionMethod: result.extractionMethod,
      fallbackUsed: result.fallbackUsed,
    });
  },
);

export default router;
