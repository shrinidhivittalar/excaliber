const REQUIRED: string[] = [
  'GROQ_API_KEY',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
]

const OPTIONAL_WITH_DEFAULTS: Record<string, string> = {
  PORT:                    '3001',
  AUTH_RATE_LIMIT_COUNT:   '5',
  AUTH_RATE_LIMIT_MS:      '900000',
  LOGIN_LOCKOUT_THRESHOLD: '5',
  LOGIN_LOCKOUT_WINDOW_MS: '900000',
  LOGIN_LOCKOUT_DURATION_MS: '900000',
  USER_RATE_LIMIT_COUNT:   '10',
  USER_RATE_LIMIT_MS:    '60000',
  INGEST_RATE_LIMIT_COUNT: '5',
  DAILY_TOKEN_LIMIT:     '100000',
  JWT_ACCESS_EXPIRES:    '15m',
  JWT_REFRESH_EXPIRES:   '7d',
}

export function validateEnv(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGIN) {
    process.stderr.write(
      '[STARTUP ERROR] ALLOWED_ORIGIN is required when NODE_ENV=production.\n'
    )
    process.exit(1)
  }

  const missing = REQUIRED.filter(key => !process.env[key])

  if (missing.length > 0) {
    process.stderr.write(
      `[STARTUP ERROR] Missing required environment variables: ${missing.join(', ')}\n` +
      `Copy server/.env.example to server/.env and fill in the values.\n`
    )
    process.exit(1)
  }

  for (const [key, defaultVal] of Object.entries(OPTIONAL_WITH_DEFAULTS)) {
    if (!process.env[key]) {
      process.stderr.write(`[STARTUP] ${key} not set, using default: ${defaultVal}\n`)
    }
  }
}

