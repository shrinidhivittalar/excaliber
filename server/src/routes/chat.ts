import { Router } from "express";
import { z } from "zod";
import { processMessage } from "../ai/groq";

const router = Router();

const chatBodySchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  sceneJson: z.record(z.unknown()),
  theme: z.enum(['minimal', 'default', 'vibrant']).optional().default('default'),
});

router.post("/", async (req, res) => {
  const parsed = chatBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, history, sceneJson, theme } = parsed.data;

  try {
    const result = await processMessage(message, history, sceneJson, theme);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
