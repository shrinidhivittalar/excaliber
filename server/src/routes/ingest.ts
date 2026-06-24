import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { ingestRateLimit } from '../middleware/userRateLimit'
import { AiServiceError, processIngest } from '../ai/groq'
import { scanForInjectionPatterns } from '../ai/injectionScan'
import { logger } from '../lib/logger'
import { withTimeout } from '../lib/retry'

const router = Router()

const ingestSchema = z.object({
  content: z
    .string()
    .min(10,    'Content too short — paste at least a few lines')
    .max(12000, 'Content too long — keep it under 12,000 characters'),
  filename:     z.string().max(200).regex(/^[\w\-. ]+$/, 'Invalid filename').optional(),
  semanticState: z.record(z.unknown()).optional(),
})

router.post('/', requireAuth, ingestRateLimit, async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { content, filename, semanticState } = parsed.data
  const startTime = Date.now()

  const suspiciousPatterns = scanForInjectionPatterns(content)
  if (suspiciousPatterns.length > 0) {
    logger.warn('injection_pattern_detected', {
      requestId: req.requestId,
      userId:    req.userId,
      patterns:  suspiciousPatterns,
      chars:     content.length,
    })
    return res.status(400).json({ error: 'Content contains disallowed patterns.' })
  }

  logger.info('ingest_request', {
    requestId: req.requestId,
    userId:    req.userId,
    chars:     content.length,
    filename,
  })

  try {
    const result = await withTimeout(
      () => processIngest(content, filename, req.requestId, req.userId, semanticState),
      30_000,
      'processIngest'
    )

    logger.info('ingest_complete', {
      requestId:  req.requestId,
      userId:     req.userId,
      durationMs: Date.now() - startTime,
    })

    res.json(result)
  } catch (err) {
    if (err instanceof AiServiceError) {
      logger.error('ingest_error', {
        requestId: req.requestId,
        userId:    req.userId,
        errorCode: err.code,
        message:   err.message,
      })

      return res.status(err.statusCode).json({ error: err.userMessage })
    }

    const message = err instanceof Error ? err.message : 'Unexpected error'
    const isTimeout = message.includes('timed out')

    logger.error('ingest_error', {
      requestId: req.requestId,
      userId:    req.userId,
      message,
    })

    res.status(isTimeout ? 503 : 500).json({
      error: isTimeout
        ? 'This is taking too long — try a shorter document.'
        : 'Could not generate a diagram from this content.',
    })
  }
})

export default router

