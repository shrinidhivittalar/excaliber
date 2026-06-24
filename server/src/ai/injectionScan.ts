// Deliberately a logging tripwire, not a blocker. Blocking on these patterns
// would false-positive on legitimate documents. The value here is visibility:
// if this fires a lot on real traffic, look closer instead of auto-rejecting.
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore (all |any )?(previous|prior|above) instructions?/i,
  /disregard (the |all )?(system|previous) (prompt|instructions?)/i,
  /you are now/i,
  /reveal (your|the) (system )?(prompt|instructions)/i,
  /act as (if you|a) /i,
]

export function scanForInjectionPatterns(content: string): string[] {
  return SUSPICIOUS_PATTERNS
    .filter(pattern => pattern.test(content))
    .map(pattern => pattern.source)
}
