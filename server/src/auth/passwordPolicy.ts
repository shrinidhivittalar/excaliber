// Small, deliberately conservative blocklist. This is not trying to
// replicate a full breached-password service, just reject the most obvious
// weak choices at registration time.
const COMMON_PASSWORDS = new Set([
  '123456', '123456789', 'qwerty', 'password', '12345678', '111111',
  '1234567890', '1234567', 'qwerty123', '000000', '1q2w3e4r5t', 'iloveyou',
  '123123', 'abc123', 'password1', 'sunshine', 'welcome', 'monkey',
  'letmein', 'dragon', 'master', '666666', 'qwertyuiop', '987654321',
  'mustang', '123321', '654321', 'superman', '1qaz2wsx', '7777777',
  'fuckyou', '121212', 'qazwsx', '123qwe', 'killer', 'trustno1',
  'jordan23', 'harley', 'hunter', 'fuckme', 'ranger', 'buster', 'thomas',
  'tigger', 'robert', 'soccer', 'batman', 'andrew', 'charlie', 'michelle',
  'jennifer', 'pepper', 'computer', 'football', 'baseball', 'starwars',
  'george', 'access', 'flower', 'hottie', 'loveme', 'jessica', 'admin',
  'admin123', 'welcome1', 'changeme', 'password123', 'letmein123',
])

export interface PasswordCheckResult {
  valid:   boolean
  reason?: string
}

const MIN_LENGTH = 10

export function validatePasswordStrength(password: string): PasswordCheckResult {
  if (password.length < MIN_LENGTH) {
    return { valid: false, reason: `Password must be at least ${MIN_LENGTH} characters.` }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return {
      valid:  false,
      reason: 'Password must include at least one letter and one number.',
    }
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid:  false,
      reason: 'This password is too common - please choose something less guessable.',
    }
  }

  return { valid: true }
}
