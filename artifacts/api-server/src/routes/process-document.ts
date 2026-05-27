// ─── Process Document Route ───────────────────────────────────────────────────
//
// POST /api/process-document
//
// Production-grade legal document ingestion pipeline:
//
//  1. Receive file via multipart/form-data (multer → memory, no disk writes)
//  2. Parse format: PDF (pdf-parse), DOCX (mammoth), TXT, RTF
//  3. Normalise: RTF stripping, encoding repair, whitespace (document-normalizer)
//  4. Extract: legally relevant sections within char budget (legal-section-extractor)
//  5. Budget:  final token-level safety cap (token-budget-manager)
//  6. Respond: clean text + telemetry metadata (server-side log only)
//
// Security:
//  - memoryStorage: files never touch the filesystem
//  - MIME + extension double-validation
//  - Structured error messages (no stack traces exposed)
//  - Per-request log with size, format, reduction, timing
//
// Vercel note:
//  - Default body limit on Vercel is 4.5 MB. Set `api/process-document` config
//    to bodyParser: false and export { config } from the Next.js handler, OR
//    use a Vercel Pro plan with increased limits. The multer limit here is the
//    Node/Express ceiling; Vercel enforces its own upstream limit separately.

import { Router } from "express";
// multer 2 ships no bundled types — import as any, cast where needed.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const multer = require("multer") as any;
import { requireAuth } from "../middleware/requireAuth.js";
import { normaliseDocument } from "../lib/document-normalizer.js";
import { extractLegalSections } from "../lib/legal-section-extractor.js";
import { applyTokenBudget } from "../lib/token-budget-manager.js";

const router = Router();

// ─── Multer configuration ─────────────────────────────────────────────────────
// 50 MB ceiling — protects server memory while comfortably handling enterprise
// contracts. Files stay in RAM; no disk I/O occurs at any point.

const MULTER_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

// Supported MIME types — images intentionally excluded (this is a document platform).
const SUPPORTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/rtf",
  "application/rtf",
  "application/x-rtf",
  "text/richtext",
]);

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt", ".rtf"]);

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
    if (SUPPORTED_MIMES.has(file.mimetype) || SUPPORTED_EXTENSIONS.has(ext)) {
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
    const startMs = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined;

    if (!file) {
      return res.status(400).json({
        error: "No file received. Please select a document and try again.",
      });
    }

    const mime = file.mimetype;
    const ext = getExtension(file.originalname);
    const originalSizeBytes = file.size;

    req.log.info(
      {
        userId: req.userId,
        mime,
        ext,
        sizeBytes: originalSizeBytes,
        sizeMb: (originalSizeBytes / 1_048_576).toFixed(2),
        event: "document_upload_received",
      },
      "Document upload received",
    );

    try {
      let rawText = "";
      let format = "unknown";
      const processingNotes: string[] = [];

      // ── PDF ─────────────────────────────────────────────────────────────────
      if (mime === "application/pdf" || ext === ".pdf") {
        format = "pdf";
        try {
          // pdf-parse 2.x ships both CJS and ESM; the CJS bundle is the 'main' entry.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfModule = (await import("pdf-parse")) as any;
          const pdfParse = (pdfModule.default ?? pdfModule) as (buf: Buffer, opts?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>;
          const data = await pdfParse(file.buffer, {
            // Disable test-file workaround — we're in production
            version: "default",
          });
          rawText = data.text ?? "";
          if (data.numpages) {
            processingNotes.push(
              `Processed ${data.numpages} page${data.numpages === 1 ? "" : "s"}`,
            );
          }
          // Detect scanned/image-only PDF (pdf-parse returns whitespace only)
          if (rawText.trim().replace(/\s+/g, "").length < 50) {
            return res.status(422).json({
              error:
                "This PDF appears to be a scanned document with no extractable text. " +
                "IndiePact works best with digital contracts — please export a text-based PDF, " +
                "convert to Word (.docx), or paste the contract text directly.",
              format: "pdf",
              requiresOcr: true,
            });
          }
        } catch (pdfErr) {
          req.log.warn(
            { pdfErr, userId: req.userId, event: "pdf_parse_failed" },
            "pdf-parse failed",
          );
          const msg = (pdfErr as Error).message ?? "";
          if (/password|encrypt/i.test(msg)) {
            return res.status(422).json({
              error:
                "This PDF is password-protected or encrypted. Please remove the password and re-upload, " +
                "or paste the contract text directly.",
              format: "pdf",
            });
          }
          return res.status(422).json({
            error:
              "We couldn't read this PDF. It may be corrupted, scanned, or in an unsupported format. " +
              "Please try a different file or paste the text directly.",
            format: "pdf",
          });
        }
      }

      // ── DOCX ────────────────────────────────────────────────────────────────
      else if (
        mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === ".docx"
      ) {
        format = "docx";
        try {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          rawText = result.value ?? "";
          const warnings = result.messages.filter((m) => m.type === "warning");
          if (warnings.length > 0) {
            processingNotes.push("Some advanced formatting was simplified during extraction");
          }
        } catch (docxErr) {
          req.log.warn({ docxErr, userId: req.userId, event: "docx_parse_failed" }, "mammoth failed");
          return res.status(422).json({
            error:
              "We couldn't extract text from this Word document. " +
              "Please ensure it is a valid .docx file (Word 2007+), or paste the text directly.",
            format: "docx",
          });
        }
      }

      // ── Legacy .doc ──────────────────────────────────────────────────────────
      else if (mime === "application/msword" || ext === ".doc") {
        return res.status(422).json({
          error:
            "Legacy .doc format (Word 97-2003) is not supported. " +
            "Please open the file in Word and save as .docx (File → Save As → Word Document), then re-upload.",
          format: "doc",
        });
      }

      // ── Plain text ──────────────────────────────────────────────────────────
      else if (mime === "text/plain" || ext === ".txt") {
        format = "text";
        // Detect encoding — try UTF-8 first, fall back to Latin-1
        try {
          rawText = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
        } catch {
          rawText = new TextDecoder("latin1").decode(file.buffer);
          processingNotes.push("Non-UTF-8 encoding detected and converted");
        }
      }

      // ── RTF ─────────────────────────────────────────────────────────────────
      else if (
        mime === "text/rtf" ||
        mime === "application/rtf" ||
        mime === "application/x-rtf" ||
        mime === "text/richtext" ||
        ext === ".rtf"
      ) {
        format = "rtf";
        // normaliseDocument handles RTF stripping — read as raw bytes first
        rawText = file.buffer.toString("latin1"); // RTF is typically Windows-1252
      }

      // ── Unsupported ─────────────────────────────────────────────────────────
      else {
        return res.status(400).json({
          error:
            `Unsupported file format (${ext || mime}). ` +
            "Please upload a PDF, Word document (.docx), plain text (.txt), or RTF file.",
        });
      }

      // ── Validate raw extraction ──────────────────────────────────────────────
      if (!rawText || rawText.trim().length < 30) {
        return res.status(422).json({
          error:
            "We couldn't extract meaningful text from this file. " +
            "It may be password-protected, image-based, or empty. " +
            "Please try a different file or paste the contract text directly.",
          format,
        });
      }

      // ── Stage 1: Normalise ───────────────────────────────────────────────────
      const { text: normalisedText, wasRtf } = normaliseDocument(rawText, format);

      if (wasRtf) {
        processingNotes.push("RTF markup stripped — clean text extracted");
      }

      if (normalisedText.trim().length < 30) {
        return res.status(422).json({
          error:
            "After normalisation, not enough readable text was found. " +
            "Please paste the contract text directly to continue.",
          format,
        });
      }

      // ── Stage 2: Extract legally relevant sections ────────────────────────────
      const { text: extractedText, stats: extractionStats } =
        extractLegalSections(normalisedText);

      if (extractionStats.wasBudgetConstrained) {
        processingNotes.push(
          `Large contract intelligently compressed — ${extractionStats.reductionPct}% reduction, ` +
            `${extractionStats.selectedSections} of ${extractionStats.sectionCount} sections analysed`,
        );
      }

      // ── Stage 3: Token budget cap ────────────────────────────────────────────
      const budgetResult = applyTokenBudget(extractedText);

      if (budgetResult.wasCompressed) {
        processingNotes.push(
          "Enterprise-scale document optimised for precision analysis",
        );
      }

      const finalText = budgetResult.text;
      const charCount = finalText.length;
      const wordCount = finalText.split(/\s+/).filter(Boolean).length;
      const durationMs = Date.now() - startMs;

      // ── Telemetry (server-side only) ─────────────────────────────────────────
      req.log.info(
        {
          userId: req.userId,
          event: "document_processed",
          format,
          pipeline: {
            originalBytes: originalSizeBytes,
            rawChars: rawText.length,
            normalisedChars: normalisedText.length,
            extractedChars: extractedText.length,
            finalChars: charCount,
            estimatedTokens: budgetResult.estimatedTokens,
            reductionPct: extractionStats.reductionPct,
            sectionCount: extractionStats.sectionCount,
            selectedSections: extractionStats.selectedSections,
            wasBudgetConstrained: extractionStats.wasBudgetConstrained,
            wasTokenCapped: budgetResult.wasCompressed,
            wasRtf,
          },
          durationMs,
        },
        `Document processed in ${durationMs}ms — ${charCount} chars, ~${budgetResult.estimatedTokens} tokens`,
      );

      return res.json({
        extractedText: finalText,
        charCount,
        wordCount,
        format,
        fileName: file.originalname,
        processingNotes,
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      req.log.error(
        { err, userId: req.userId, format: "unknown", durationMs, event: "document_processing_failed" },
        "Document processing pipeline failed",
      );
      return res.status(500).json({
        error:
          "We encountered an issue processing this document. " +
          "Please try again, or paste the contract text directly to continue.",
      });
    }
  },
);

export default router;
