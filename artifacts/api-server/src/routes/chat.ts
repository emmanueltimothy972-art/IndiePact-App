import { Router } from "express";
import { z } from "zod";
import { runNegotiatorChat } from "../lib/openai.js";

const router = Router();

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

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
    return res.status(500).json({ error: "AI unavailable", reply: "The AI is currently unavailable. Please try again shortly." });
  }
});

export default router;
