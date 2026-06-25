import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { openai } from "../lib/openai.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireSupabase } from "../lib/supabase.js";

const router = Router();

const FREE_PLANS = new Set(["free"]);

const ExtractBodySchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

router.post("/extract-file", requireAuth, async (req: Request, res: Response) => {
  const parse = ExtractBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const userId = req.userId!;

  let isPaid = false;
  try {
    const db = requireSupabase();
    const { data } = await db
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .single();
    const plan = (data?.plan ?? "free").toLowerCase();
    isPaid = !FREE_PLANS.has(plan);
  } catch {
    isPaid = false;
  }

  if (!isPaid) {
    return res.status(403).json({
      error: "Pro tier required",
      message: "Upgrade to Pro to access forensic-level OCR scanning.",
    });
  }

  const { imageBase64, mimeType } = parse.data;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "imageBase64 and mimeType are required for Pro extraction" });
  }

  if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) {
    return res.status(400).json({ error: "Unsupported file type. Supported: PNG, JPG, WEBP" });
  }

  if (!openai) {
    req.log.error({ event: "openai_unavailable" }, "OpenAI client is not configured — OPENAI_API_KEY missing");
    return res.status(503).json({ error: "AI extraction is temporarily unavailable. Please try again later." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              // Tighter instruction: no filler, structured output only.
              text: "Extract all text from this contract document image. Output ONLY the raw text preserving paragraph breaks. No summaries, no commentary, no preamble.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                // "auto" lets the model choose tile count based on image content.
                // For dense text (contracts), it will use high detail automatically.
                // For simple/sparse images, it falls back to low (85 tokens vs 765+).
                detail: "auto",
              },
            },
          ],
        },
      ],
      // Reduced from 4000: a single contract page extracts to ~400–900 tokens
      // of text. 2000 handles even dense multi-column layouts with headroom.
      max_tokens: 2000,
    });

    const usage = completion.usage;
    if (usage) {
      const { estimateCallCostUSD } = await import("../lib/openai.js");
      const costUSD = estimateCallCostUSD(usage.prompt_tokens, usage.completion_tokens);
      req.log.info(
        { input: usage.prompt_tokens, output: usage.completion_tokens, costUSD },
        "[AI:ocr] extraction token usage"
      );
    }

    const extractedText = completion.choices[0]?.message?.content ?? "";
    return res.json({ extractedText, characterCount: extractedText.length });
  } catch (err) {
    req.log.error({ err }, "File extraction failed");
    return res.status(500).json({ error: "Extraction failed. Please try again." });
  }
});

export default router;
