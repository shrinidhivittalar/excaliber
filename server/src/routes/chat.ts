import { Router } from "express";
import { z } from "zod";
import { processMessage } from "../ai/groq";
import { logger } from "../lib/logger";
import { withTimeout } from "../lib/retry";

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
  const startTime = Date.now();

  logger.info('chat_request', { requestId: req.requestId, userId: req.userId });

  try {
    const result = await withTimeout(
      () => processMessage(message, history, sceneJson, theme, req.requestId, req.userId),
      30_000,
      'processMessage'
    );
    logger.info('chat_complete', {
      requestId: req.requestId,
      userId: req.userId,
      durationMs: Date.now() - startTime,
      toolsUsed: result.toolsUsed,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const isTimeout = message.includes('timed out')
    const isRateLimit = message.toLowerCase().includes('rate')

    const userMessage = isTimeout
      ? 'This is taking too long — try a simpler request.'
      : isRateLimit
        ? 'Too many requests — wait a moment and try again.'
        : 'Something went wrong. Try again.'

    logger.error('chat_error', {
      requestId: req.requestId,
      userId: req.userId,
      errorCode: isTimeout ? 'TIMEOUT' : isRateLimit ? 'RATE_LIMIT' : 'INTERNAL',
      message,
    });

    res.status(isTimeout || isRateLimit ? 503 : 500).json({ error: userMessage });
  }
});

export default router;
