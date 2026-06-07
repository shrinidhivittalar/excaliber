import type { Request, Response, NextFunction } from 'express'
import { createRequestId } from '../lib/logger'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      userId?: string
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = createRequestId()
  res.setHeader('X-Request-Id', req.requestId)
  next()
}
