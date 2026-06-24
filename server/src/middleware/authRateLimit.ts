import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

interface BucketEntry {
  count:       number
  windowStart: number
}

// IP-keyed and safe to run before authentication exists.
export function createIpRateLimit(options: {
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
    const ip     = req.ip ?? 'unknown'
    const now    = Date.now()
    const bucket = store.get(ip)

    if (!bucket || now - bucket.windowStart > windowMs) {
      store.set(ip, { count: 1, windowStart: now })
      next()
      return
    }

    if (bucket.count >= requestsPerWindow) {
      const retryAfterMs = windowMs - (now - bucket.windowStart)
      logger.warn('auth_rate_limited', { ip, count: bucket.count, retryAfterMs })
      res.status(429).json({ error: errorMessage, retryAfterMs })
      return
    }

    bucket.count++
    next()
  }
}

export const authRateLimit = createIpRateLimit({
  requestsPerWindow: parseInt(process.env.AUTH_RATE_LIMIT_COUNT ?? '5', 10),
  windowMs:          parseInt(process.env.AUTH_RATE_LIMIT_MS    ?? '900000', 10),
  errorMessage:      'Too many attempts - wait a few minutes and try again.',
})
