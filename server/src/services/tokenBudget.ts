import { logger } from '../lib/logger'

const DAILY_TOKEN_LIMIT = parseInt(process.env.DAILY_TOKEN_LIMIT ?? '100000', 10)

interface BucketEntry {
  tokens: number
  date:   string
}

const store = new Map<string, BucketEntry>()

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function checkBudget(userId: string): { allowed: boolean; remaining: number } {
  const d         = today()
  const entry     = store.get(userId)
  const used      = entry?.date === d ? entry.tokens : 0
  const remaining = Math.max(0, DAILY_TOKEN_LIMIT - used)
  return { allowed: remaining > 0, remaining }
}

export function recordUsage(userId: string, tokens: number): void {
  const d     = today()
  const entry = store.get(userId)

  if (!entry || entry.date !== d) {
    store.set(userId, { tokens, date: d })
  } else {
    entry.tokens += tokens
  }

  logger.info('token_usage', { userId, tokens, dailyTotal: store.get(userId)!.tokens })
}

setInterval(() => {
  const d = today()
  for (const [key, entry] of store) {
    if (entry.date !== d) store.delete(key)
  }
}, 60 * 60_000)
