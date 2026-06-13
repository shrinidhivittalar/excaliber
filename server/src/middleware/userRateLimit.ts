import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

interface BucketEntry {
  count:       number
  windowStart: number
}

export function createUserRateLimit(options: {
  requestsPerWindow: number
  windowMs:          number
  errorMessage:      string
}) {
  const { requestsPerWindow, windowMs, errorMessage } = options
  const store = new Map<string, BucketEntry>()

  setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [key, entry] of store) {
      if (entry.windowStart < cutoff) store.delete(key)
    }
  }, 5 * 60_000)

  return function (req: Request, res: Response, next: NextFunction): void {
    const userId = req.userId
    if (!userId) { next(); return }

    const now    = Date.now()
    const bucket = store.get(userId)

    if (!bucket || now - bucket.windowStart > windowMs) {
      store.set(userId, { count: 1, windowStart: now })
      next()
      return
    }

    if (bucket.count >= requestsPerWindow) {
      const retryAfterMs = windowMs - (now - bucket.windowStart)
      logger.warn('user_rate_limited', { userId, count: bucket.count, retryAfterMs })
      res.status(429).json({ error: errorMessage, retryAfterMs })
      return
    }

    bucket.count++
    next()
  }
}

export const userRateLimit = createUserRateLimit({
  requestsPerWindow: parseInt(process.env.USER_RATE_LIMIT_COUNT ?? '10', 10),
  windowMs:          parseInt(process.env.USER_RATE_LIMIT_MS    ?? '60000', 10),
  errorMessage:      'Too many requests — wait a moment and try again.',
})

// Vision calls are heavier — stricter limit for the critique endpoint
export const critiqueRateLimit = createUserRateLimit({
  requestsPerWindow: parseInt(process.env.CRITIQUE_RATE_LIMIT_COUNT ?? '5', 10),
  windowMs:          60_000,
  errorMessage:      'Too many diagram reviews — wait a moment.',
})
