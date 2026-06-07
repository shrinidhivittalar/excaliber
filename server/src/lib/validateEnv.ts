const REQUIRED: string[] = [
  'GROQ_API_KEY',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
]

const OPTIONAL_WITH_DEFAULTS: Record<string, string> = {
  PORT:                  '3001',
  USER_RATE_LIMIT_COUNT: '10',
  USER_RATE_LIMIT_MS:    '60000',
  DAILY_TOKEN_LIMIT:     '100000',
  JWT_ACCESS_EXPIRES:    '15m',
  JWT_REFRESH_EXPIRES:   '7d',
}

export function validateEnv(): void {
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
