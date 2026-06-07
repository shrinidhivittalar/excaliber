import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

interface BucketEntry {
  count:       number
  windowStart: number
}

const REQUESTS_PER_WINDOW = parseInt(process.env.USER_RATE_LIMIT_COUNT ?? '10', 10)
const WINDOW_MS            = parseInt(process.env.USER_RATE_LIMIT_MS   ?? '60000', 10)

const buckets = new Map<string, BucketEntry>()

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [key, entry] of buckets) {
    if (entry.windowStart < cutoff) buckets.delete(key)
  }
}, 5 * 60_000)

export function userRateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.userId
  if (!userId) { next(); return }

  const now    = Date.now()
  const bucket = buckets.get(userId)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(userId, { count: 1, windowStart: now })
    next()
    return
  }

  if (bucket.count >= REQUESTS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - bucket.windowStart)

    logger.warn('user_rate_limited', { userId, count: bucket.count, retryAfterMs })

    res.status(429).json({
      error:        'Too many requests — wait a moment and try again.',
      retryAfterMs,
    })
    return
  }

  bucket.count++
  next()
}
