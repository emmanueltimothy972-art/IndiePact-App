import { Router } from "express";
import { z } from "zod";
import { openai } from "../lib/openai.js";

const router = Router();

const ExtractBodySchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  tier: z.enum(["free", "pro"]).default("free"),
});

router.post("/extract-file", async (req, res) => {
  const parse = ExtractBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { tier } = parse.data;

  if (tier === "free") {
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this contract document image. Return ONLY the raw extracted text, preserving paragraph structure. Do not summarize or analyze — just extract.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    const extractedText = completion.choices[0]?.message?.content ?? "";
    return res.json({ extractedText, characterCount: extractedText.length });
  } catch (err) {
    req.log.error({ err }, "File extraction failed");
    return res.status(500).json({ error: "Extraction failed. Please try again." });
  }
});

export default router;
