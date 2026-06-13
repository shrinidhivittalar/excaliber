# Security Backlog

Audit date: 2026-06-12
Status: Pending — do not tackle until explicitly instructed.

---

## Audit Results

| # | Item | Status | Location |
|---|------|--------|----------|
| 1 | Async 202 / queue | MISSING | `server/src/routes/chat.ts` |
| 2 | Per-user rate limiting | PRESENT | `server/src/middleware/userRateLimit.ts` |
| 3 | Prompt input sanitization | PARTIAL | `server/src/routes/chat.ts:17`, `server/src/routes/ingest.ts:28` |
| 4 | Canvas / enum whitelist | PRESENT | `server/src/ai/layout/validation.ts`, `server/src/ai/groq.ts:40-109` |
| 5 | Parameter injection guard | PRESENT | `server/src/ai/groq.ts:397-400` |
| 6 | Request timeouts | PRESENT | `server/src/routes/chat.ts:62-65`, `server/src/lib/retry.ts` |
| 7 | SSRF prevention | PRESENT | `server/src/services/images.ts:51-58` |
| 8 | NSFW / pixel safety gate | MISSING | `server/src/services/images.ts` |
| 9 | EXIF stripping | N/A | Images served as Pexels CDN URLs, never stored locally |
| 10 | Storage lifecycle / auto-purge | PARTIAL | `server/src/services/versions.ts:4-44` |
| 11 | JWT / auth security | PRESENT | `server/src/auth/tokens.ts`, `server/src/routes/auth.ts:19-25` |
| 12 | MongoDB injection | PRESENT | `server/src/routes/drawings.ts` (escapeRegex + Mongoose ODM) |

---

## Issues to Fix (priority order)

### CRITICAL

#### 1. Prompt injection not blocked on ingest
**File:** `server/src/routes/ingest.ts:28`
**Issue:** Detects patterns like "ignore previous instructions" but only logs — does not block or reject the request.
**Fix:** Return 400 and reject the request when injection patterns are detected.

#### 2. JWT hard crashes on missing secrets
**File:** `server/src/auth/tokens.ts:5-7`
**Issue:** Falls back to weak hardcoded strings (`"fallback-access-secret"`) if env vars are missing. A misconfigured deploy silently uses weak signing.
**Fix:** Throw on startup if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing/empty.

---

### MODERATE

#### 3. Auth endpoints not rate limited
**File:** `server/src/routes/auth.ts` (register, login, refresh)
**Issue:** No rate limiting on auth routes — open to brute force and account enumeration.
**Fix:** Apply express-rate-limit (stricter than chat — e.g. 5 req/15min) to `/register`, `/login`, `/refresh`.

#### 4. No NSFW filter on image results
**File:** `server/src/services/images.ts`
**Issue:** Pexels results returned raw with no content safety check before embedding in the canvas.
**Fix:** Integrate a lightweight NSFW classifier (e.g. NSFWJS or a Cloudflare Worker with ClipGuard) as a post-fetch gate.

---

### LOW / INTENTIONAL

#### 5. Synchronous request handling (no 202 / queue)
**File:** `server/src/routes/chat.ts`
**Issue:** Blocks on AI response instead of returning 202 and streaming via WebSocket/polling.
**Note:** Intentional for now — real-time drawing UX. Revisit only if scaling to multiple concurrent users becomes a requirement.

#### 6. No drawing data TTL
**File:** `server/src/models/` (Drawing, User)
**Issue:** Drawings and user data stored indefinitely. No auto-purge policy.
**Note:** Version cap (20 versions max) is in place. Full lifecycle policy deferred until storage costs become a concern.
