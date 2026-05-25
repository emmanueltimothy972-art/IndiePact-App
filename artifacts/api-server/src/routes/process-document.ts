import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth.js";
import { openai } from "../lib/openai.js";

const router = Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/rtf",
      "application/rtf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    const name = file.originalname.toLowerCase();
    const byExt =
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc") ||
      name.endsWith(".txt") ||
      name.endsWith(".rtf");
    if (allowed.includes(file.mimetype) || byExt) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload PDF, Word (.docx), plain text, or an image."));
    }
  },
});

// ─── Text compression helpers ─────────────────────────────────────────────────

function compressExtractedText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4);

  // Strip header/footer noise: short lines with only numbers or dashes
  const meaningful = lines.filter((l) => !/^[-–—\d\s.]+$/.test(l));

  // Deduplicate consecutive identical lines
  const deduped: string[] = [];
  for (const line of meaningful) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/process-document",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file received. Please select a file and try again." });
    }

    const mime = file.mimetype;
    const name = file.originalname.toLowerCase();

    req.log.info(
      { userId: req.userId, mime, size: file.size, name: file.originalname },
      "Processing document upload",
    );

    try {
      let extractedText = "";
      let format = "unknown";
      const notes: string[] = [];

      // ── PDF ────────────────────────────────────────────────────────────────
      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        format = "pdf";
        try {
          const pdfParse = (await import("pdf-parse")).default;
          const data = await pdfParse(file.buffer);
          extractedText = data.text ?? "";
          if (data.numpages) {
            notes.push(`Processed ${data.numpages} page${data.numpages === 1 ? "" : "s"}`);
          }
        } catch (pdfErr) {
          req.log.warn({ pdfErr }, "pdf-parse failed — document may be scanned");
          return res.status(422).json({
            error:
              "This PDF appears to be scanned or image-based. IndiePact is optimized for text-based contracts — please try uploading the file as an image, or paste the contract text directly.",
            format: "pdf",
            requiresOcr: true,
          });
        }
      }

      // ── DOCX ──────────────────────────────────────────────────────────────
      else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx")
      ) {
        format = "docx";
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value ?? "";
        if (result.messages.some((m) => m.type === "warning")) {
          notes.push("Some formatting simplified during extraction");
        }
      }

      // ── DOC (legacy Word) ─────────────────────────────────────────────────
      else if (mime === "application/msword" || name.endsWith(".doc")) {
        return res.status(422).json({
          error:
            "Legacy .doc files are not supported. Please save your document as .docx (Word 2007+) and re-upload, or paste the contract text directly.",
          format: "doc",
        });
      }

      // ── Plain text / RTF ──────────────────────────────────────────────────
      else if (
        mime.startsWith("text/") ||
        name.endsWith(".txt") ||
        name.endsWith(".rtf")
      ) {
        format = "text";
        extractedText = file.buffer.toString("utf-8");
      }

      // ── Image OCR ─────────────────────────────────────────────────────────
      else if (mime.startsWith("image/")) {
        format = "image";
        if (!openai) {
          return res.status(503).json({
            error: "OCR processing is temporarily unavailable. Please paste the contract text directly.",
          });
        }
        const base64 = file.buffer.toString("base64");
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this contract document image. Return ONLY the raw extracted text, preserving paragraph breaks and clause structure. Do not summarize — extract everything visible.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mime};base64,${base64}`, detail: "high" },
                },
              ],
            },
          ],
          max_tokens: 4000,
        });
        extractedText = completion.choices[0]?.message?.content ?? "";
        notes.push("Text extracted via OCR");
      } else {
        return res.status(400).json({
          error: "Unsupported format. Please upload a PDF, Word (.docx), plain text file, or an image of the contract.",
        });
      }

      // ── Validate extraction ────────────────────────────────────────────────
      if (!extractedText || extractedText.trim().length < 30) {
        return res.status(422).json({
          error:
            "We couldn't extract meaningful text from this file. It may be password-protected, image-based, or empty. Please try pasting the contract text directly.",
          format,
          requiresOcr: format === "pdf",
        });
      }

      // ── Compress ──────────────────────────────────────────────────────────
      const compressed = compressExtractedText(extractedText);
      const charCount = compressed.length;
      const wordCount = compressed.split(/\s+/).filter(Boolean).length;

      if (charCount > 60_000) {
        notes.push(
          "Large contract detected — IndiePact will analyze priority sections using an optimized processing pipeline",
        );
      }

      req.log.info(
        { userId: req.userId, format, charCount, wordCount },
        "Document processed successfully",
      );

      return res.json({
        extractedText: compressed,
        charCount,
        wordCount,
        format,
        fileName: file.originalname,
        processingNotes: notes,
      });
    } catch (err) {
      req.log.error({ err }, "Document processing failed");
      return res.status(500).json({
        error:
          "We encountered an issue processing this document. Please try again, or paste the contract text directly to continue.",
      });
    }
  },
);

export default router;
