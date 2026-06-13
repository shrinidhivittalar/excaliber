import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { critiqueRateLimit } from '../middleware/userRateLimit'
import { critiqueImage } from '../ai/vision'
import { runCorrectionPass } from '../ai/groq'
import { logger } from '../lib/logger'
import { withTimeout } from '../lib/retry'

const router = Router()

const critiqueSchema = z.object({
  // PNG exported from Excalidraw, base64 encoded, max ~300KB
  imageBase64: z
    .string()
    .min(100, 'Image too small')
    .max(400_000, 'Image too large — reduce canvas size or zoom out'),

  // The original DiagramPlan used to generate this diagram
  originalPlan: z.record(z.unknown()),

  // The current sceneJson (used for correction pass context)
  sceneJson: z.record(z.unknown()),
})

router.post('/', requireAuth, critiqueRateLimit, async (req, res) => {
  const parsed = critiqueSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { imageBase64, originalPlan, sceneJson } = parsed.data
  const startTime = Date.now()

  logger.info('critique_request', { requestId: req.requestId, userId: req.userId })

  try {
    // Step 1: ask vision model what it sees
    const critique = await withTimeout(
      () => critiqueImage(imageBase64),
      15_000,
      'critiqueImage'
    )

    logger.info('critique_result', {
      requestId:  req.requestId,
      userId:     req.userId,
      hasIssues:  critique.hasIssues,
      issues:     critique.issues,
      durationMs: Date.now() - startTime,
    })

    // Step 2: if no issues, return early — no correction needed
    if (!critique.hasIssues || critique.issues.length === 0) {
      return res.json({ corrected: false, sceneJson: null })
    }

    // Step 3: run a correction pass
    const corrected = await withTimeout(
      () => runCorrectionPass(
        critique.issues,
        originalPlan as any,
        sceneJson,
        req.requestId,
        req.userId,
      ),
      25_000,
      'runCorrectionPass'
    )

    if (!corrected) {
      return res.json({ corrected: false, sceneJson: null })
    }

    logger.info('critique_corrected', {
      requestId: req.requestId,
      userId:    req.userId,
      issues:    critique.issues,
      totalMs:   Date.now() - startTime,
    })

    res.json({
      corrected:   true,
      sceneJson:   corrected.sceneJson,
      issuesFound: critique.issues,
    })

  } catch (err) {
    // Critique failure must never block the user — log and return no correction
    logger.warn('critique_failed', {
      requestId: req.requestId,
      message:   err instanceof Error ? err.message : String(err),
    })
    res.json({ corrected: false, sceneJson: null })
  }
})

export default router
