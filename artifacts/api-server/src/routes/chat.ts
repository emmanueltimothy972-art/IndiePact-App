import { Router } from "express";
import { z } from "zod";
import { runNegotiatorChat, runProsecutorChat } from "../lib/openai.js";

const router = Router();

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

// ─── Negotiator Chat (rehearsal partner) ──────────────────────────────────────

const ChatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  scenario: z.string().min(1),
  history: z.array(ChatMessageSchema).max(20).default([]),
});

router.post("/chat", async (req, res) => {
  const parse = ChatBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { message, scenario, history } = parse.data;
  const messages = [
    ...history,
    { role: "user" as const, content: message },
  ];

  try {
    const reply = await runNegotiatorChat(messages, scenario);
    return res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Shadow negotiator chat failed");
    return res.status(500).json({
      error: "AI unavailable",
      reply: "The AI is currently unavailable. Please try again shortly.",
    });
  }
});

// ─── The Prosecutor (structured JSON, with rebuttal email) ────────────────────

const ProsecutorBodySchema = z.object({
  message: z.string().min(1).max(3000),
  history: z.array(ChatMessageSchema).max(30).default([]),
  caseContext: z.object({
    agreementType: z.string(),
    jurisdiction: z.string(),
    financialExposure: z.string(),
  }).optional(),
});

router.post("/prosecutor", async (req, res) => {
  const parse = ProsecutorBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { message, history, caseContext } = parse.data;

  // Build history including only the content strings (not structured objects) for the AI
  const messages = [
    ...history,
    { role: "user" as const, content: message },
  ];

  const context = caseContext ?? {
    agreementType: "Not specified",
    jurisdiction: "Not specified",
    financialExposure: "Not specified",
  };

  try {
    // Returns structured ProsecutorResponse: { diagnosis, exposure, counterMove, rebuttalEmail, tacticalDirective }
    const reply = await runProsecutorChat(messages, context);
    return res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Prosecutor chat failed");
    return res.status(500).json({
      error: "AI unavailable",
      reply: {
        diagnosis: "Investigation interrupted — AI temporarily unavailable.",
        exposure: "Unable to assess at this time.",
        counterMove: "Stand by for reconnection.",
        rebuttalEmail: "",
        tacticalDirective: "Try again in 60 seconds.",
      },
    });
  }
});

export default router;
