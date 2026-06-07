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

function write(level: LogLevel, message: string, ctx: LogContext = {}): void {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, message, ...ctx }) + '\n'
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
