import { Router } from "express";
import { z } from "zod";
import { processMessage } from "../ai/groq";
import { logger } from "../lib/logger";
import { withTimeout } from "../lib/retry";
import { requireAuth } from "../middleware/auth";
import { userRateLimit } from "../middleware/userRateLimit";
import { checkBudget } from "../services/tokenBudget";

const router = Router();

const chatSchema = z.object({
  message: z
    .string()
    .min(1,    'Message cannot be empty')
    .max(2000, 'Message too long — keep it under 2000 characters')
    .transform(s => s.replace(/\x00/g, '').trim()),

  history: z
    .array(z.object({
      role:    z.enum(['user', 'assistant']),
      content: z.string().max(4000),
    }))
    .max(40, 'History too long')
    .default([]),

  sceneJson: z.record(z.unknown()).default({}),

  theme: z
    .enum(['minimal', 'default', 'vibrant'])
    .default('default'),
});

router.post("/", requireAuth, userRateLimit, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { message, history, sceneJson, theme } = parsed.data;
  const startTime = Date.now();

  if (req.userId) {
    const { allowed, remaining } = checkBudget(req.userId)
    if (!allowed) {
      logger.warn('budget_exceeded', { requestId: req.requestId, userId: req.userId })
      res.status(429).json({
        error: "You've reached your daily diagram limit. It resets at midnight.",
      })
      return
    }
    if (remaining < 5000) {
      logger.info('budget_low', { requestId: req.requestId, userId: req.userId, remaining })
    }
  }

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
    const isTimeout  = message.includes('timed out')
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
