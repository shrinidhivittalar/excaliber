import { logger } from './logger'

interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  shouldRetry?: (err: unknown, attempt: number) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, shouldRetry = () => true } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isLast = attempt === maxAttempts
      const canRetry = shouldRetry(err, attempt)

      if (isLast || !canRetry) throw err

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
      logger.warn('groq_retry', { attempt, delayMs, error: String(err) })
      await new Promise<void>(r => setTimeout(r, delayMs))
    }
  }

  throw lastError
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  })

  try {
    const result = await Promise.race([fn(), timeout])
    clearTimeout(timer!)
    return result
  } catch (err) {
    clearTimeout(timer!)
    throw err
  }
}
