import crypto from 'crypto'

type LogLevel = 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?:    string
  userId?:       string
  durationMs?:   number
  inputTokens?:  number
  outputTokens?: number
  totalTokens?:  number
  toolsUsed?:    string[]
  layout?:       string
  nodeCount?:    number
  errorCode?:    string
  [key: string]: unknown
}

const SECRET_KEY_PATTERN = /secret|password|token|authorization|api[-_]?key|connectionstring|mongodb_uri/i

function redactString(value: string): string {
  // Catches connection-string-with-credentials patterns even when the field
  // name itself is harmless, such as an error.message containing a Mongo URI.
  return value.replace(/\/\/[^:@/\s]+:[^@/\s]+@/g, '//[REDACTED]@')
}

function redactContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(ctx)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = '[REDACTED]'
    } else if (typeof value === 'string') {
      out[key] = redactString(value)
    } else if (Array.isArray(value)) {
      out[key] = value
    } else if (value !== null && typeof value === 'object') {
      out[key] = redactContext(value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }

  return out
}

function write(level: LogLevel, message: string, ctx: LogContext = {}): void {
  const safeCtx = redactContext(ctx)
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, message, ...safeCtx }) + '\n'
  )
}

export const logger = {
  info:  (message: string, ctx?: LogContext) => write('info',  message, ctx),
  warn:  (message: string, ctx?: LogContext) => write('warn',  message, ctx),
  error: (message: string, ctx?: LogContext) => write('error', message, ctx),
}

export function createRequestId(): string {
  return crypto.randomBytes(6).toString('hex')
}
