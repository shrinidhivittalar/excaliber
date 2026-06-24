import { logger } from '../lib/logger'

interface AttemptEntry {
  failures:       number
  firstFailureAt: number
  lockedUntil:    number | null
}

const MAX_FAILURES = parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD     ?? '5', 10)
const WINDOW_MS    = parseInt(process.env.LOGIN_LOCKOUT_WINDOW_MS      ?? '900000', 10)
const LOCKOUT_MS   = parseInt(process.env.LOGIN_LOCKOUT_DURATION_MS    ?? '900000', 10)

const attempts = new Map<string, AttemptEntry>()

function normalizeEmail(email: string): string {
  return email.toLowerCase()
}

export function isLockedOut(email: string): { locked: boolean; retryAfterMs?: number } {
  const key   = normalizeEmail(email)
  const entry = attempts.get(key)

  if (!entry?.lockedUntil) return { locked: false }

  const now = Date.now()
  if (now >= entry.lockedUntil) {
    attempts.delete(key)
    return { locked: false }
  }

  return { locked: true, retryAfterMs: entry.lockedUntil - now }
}

export function recordFailedAttempt(email: string): void {
  const key   = normalizeEmail(email)
  const now   = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: null })
    return
  }

  entry.failures++
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS
    logger.warn('account_locked', { email: key, failures: entry.failures })
  }
}

export function clearAttempts(email: string): void {
  attempts.delete(normalizeEmail(email))
}
