# Excaliber — Functional & Non-Functional Requirements

**Version**: 1.0  
**Last Updated**: June 2026

---

## 1. Overview

This document specifies the complete functional and non-functional requirements for Excaliber, including edge cases, validation rules, and acceptance criteria. Requirements are grouped by feature area.

---

## 2. Authentication Requirements

### 2.1 Registration

| ID | Requirement |
|----|-------------|
| AUTH-01 | The system shall accept an email and password to create a new user account |
| AUTH-02 | Email must match the pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| AUTH-03 | Password must be a minimum of 8 characters |
| AUTH-04 | Email must be stored in lowercase and trimmed of whitespace |
| AUTH-05 | Password must be hashed with bcrypt at 12 rounds before storage |
| AUTH-06 | If the email is already registered, the server shall return HTTP 409 |
| AUTH-07 | On successful registration, the server shall issue a JWT access token and set a refresh token httpOnly cookie |

**Edge Cases:**
- Email with mixed case (`User@Example.COM`) is normalised to lowercase before the uniqueness check
- Password containing only spaces passes the length check but is valid input — no dictionary enforcement at this scope
- Concurrent registrations with the same email — MongoDB unique index guarantees only one succeeds; the other receives 409

---

### 2.2 Login

| ID | Requirement |
|----|-------------|
| AUTH-08 | The system shall authenticate a user by email and password |
| AUTH-09 | The server shall compare the submitted password against the stored bcrypt hash |
| AUTH-10 | If either the email does not exist or the password does not match, the server shall return HTTP 401 with a generic message — email existence shall not be disclosed |
| AUTH-11 | On successful login, the server shall issue a new JWT access token and set a new refresh token httpOnly cookie |

---

### 2.3 JWT Access Token

| ID | Requirement |
|----|-------------|
| AUTH-12 | Access tokens shall be signed using `JWT_ACCESS_SECRET` (validated present at startup) |
| AUTH-13 | Access tokens shall expire after 15 minutes |
| AUTH-14 | Access tokens shall be sent by the client in the `Authorization: Bearer <token>` header |
| AUTH-15 | The `requireAuth` middleware shall reject requests with missing, malformed, or expired tokens with HTTP 401 |
| AUTH-16 | If `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are not set, the server shall exit at startup |

---

### 2.4 Refresh Tokens

| ID | Requirement |
|----|-------------|
| AUTH-17 | Refresh tokens shall be a 64-character nanoid |
| AUTH-18 | Refresh tokens shall be stored in MongoDB with a 7-day TTL index |
| AUTH-19 | Refresh tokens shall be delivered via an httpOnly, Secure (in production), SameSite cookie |
| AUTH-20 | On use, the old refresh token shall be deleted immediately and a new one issued (rotation) |
| AUTH-21 | If the refresh token is missing or expired, the server shall return HTTP 401 |

**Edge Cases:**
- Token reuse after rotation: the old token no longer exists in MongoDB — returns 401, client redirects to login
- Concurrent refresh calls: the first call consumes the token; the second returns 401

---

### 2.5 Password Reset

| ID | Requirement |
|----|-------------|
| AUTH-22 | The forgot-password endpoint shall always return HTTP 200 regardless of whether the email exists |
| AUTH-23 | If the email exists, a SHA-256-hashed reset token shall be stored with a 1-hour expiry |
| AUTH-24 | Any existing reset tokens for the user shall be deleted before creating a new one |
| AUTH-25 | The raw token (not the hash) shall be included in the emailed reset link |
| AUTH-26 | On reset-password submission, the server shall hash the submitted token and compare to the stored hash |
| AUTH-27 | If the token is not found or has expired, the server shall return HTTP 400 |
| AUTH-28 | On successful reset, the token record shall be deleted and the user's password hash updated |

**Edge Cases:**
- User requests reset twice in quick succession: first token is deleted before second is stored — only the most recent link works
- Reset link clicked after 1 hour: TTL index has auto-deleted the record — returns 400

---

## 3. AI Chat Requirements

### 3.1 Message Processing

| ID | Requirement |
|----|-------------|
| CHAT-01 | `POST /api/chat` shall accept a user message, conversation history, current scene JSON, theme, and optional semantic state |
| CHAT-02 | The server shall inject a text summary of the current canvas into the user message context before calling the AI |
| CHAT-03 | Conversation history shall be trimmed to the first message plus the last 6 exchanges before each AI call |
| CHAT-04 | The AI shall be called in a tool-calling loop for a maximum of 10 iterations |
| CHAT-05 | Every Groq API call shall be wrapped in `withRetry(3)` with exponential backoff |
| CHAT-06 | Every Groq API call shall be wrapped in `withTimeout(25000)` |
| CHAT-07 | Retries shall trigger on: rate limit errors (429), timeouts, and 503 responses |
| CHAT-08 | If the AI returns a Mermaid markdown code block instead of a tool call, the server shall parse it via `@excalidraw/mermaid-to-excalidraw` as a fallback |
| CHAT-09 | Token usage shall be recorded per user after each request |

**Edge Cases:**
- User sends an empty message: client prevents submission; `message` field validated as non-empty string at server
- AI exceeds 10 tool-call iterations: loop exits, last known `sceneJson` returned with a fallback reply
- Groq returns a 503 after 3 retries: server returns HTTP 503 to client; client shows "Service is busy" toast

---

### 3.2 Intent Detection (Client-Side)

| ID | Requirement |
|----|-------------|
| CHAT-10 | Intent detection shall run client-side using regex matching — no round-trip required |
| CHAT-11 | Detection shall complete in under 1 millisecond |
| CHAT-12 | The detected intent shall be shown to the user as a pill above the CommandBar for 3 seconds |
| CHAT-13 | If `wireframe` intent is detected, the theme shall be overridden to `minimal` for that request only |
| CHAT-14 | Theme override shall not modify the user's persisted theme preference |

**Supported Intents:**

| Intent | Pattern Example | Effect |
|--------|----------------|--------|
| `show_me` | "show me a human heart" | Server calls `fetch_images` before drawing |
| `wireframe` | "wireframe the login page" | Theme set to `minimal` for this request |
| `system_design` | "system design for Twitter" | 5-layer architecture layout used |
| `annotate` | "annotate this diagram" | Merge mode, `ann_` prefix on text nodes |
| `refine` | "clean this up" | Sizing/layout adjusted, no full redraw |

---

### 3.3 Rate Limiting

| ID | Requirement |
|----|-------------|
| CHAT-15 | `/api/chat` shall be limited to 10 requests per minute per IP |
| CHAT-16 | All authenticated routes shall enforce a per-user rate limit |
| CHAT-17 | The daily per-user Groq token budget shall default to 100,000 tokens |
| CHAT-18 | Exceeding the token budget shall return HTTP 429 |

---

## 4. Layout Engine Requirements

### 4.1 General

| ID | Requirement |
|----|-------------|
| LAYOUT-01 | The AI shall never produce pixel coordinates — it outputs only a semantic `DiagramPlan` |
| LAYOUT-02 | The layout engine shall compute all `x`, `y`, `width`, and `height` values server-side |
| LAYOUT-03 | The engine shall validate and auto-repair the `DiagramPlan` before running layout |
| LAYOUT-04 | Auto-repair shall fill missing node IDs, clamp unknown sizes to `m`, and remove edges referencing unknown nodes |
| LAYOUT-05 | If validation fails irrecoverably, a `LayoutError` with `stage: "validation"` shall be returned |
| LAYOUT-06 | In merge mode, the engine shall receive existing element positions to avoid placing new nodes on top of existing ones |
| LAYOUT-07 | After layout, a `cameraUpdate` element shall be prepended to the output so the canvas auto-fits on render |

---

### 4.2 Algorithm Selection

| ID | Requirement |
|----|-------------|
| LAYOUT-08 | The engine shall support exactly 7 layout algorithms: `flowchart`, `hierarchy`, `circular`, `comparison`, `timeline`, `mindmap`, `freeform` |
| LAYOUT-09 | Algorithm selection shall be driven by the `layout` field in the `DiagramPlan` |
| LAYOUT-10 | If an unknown layout value is received, the engine shall default to `freeform` |

---

### 4.3 Edge Routing

| ID | Requirement |
|----|-------------|
| LAYOUT-11 | Arrows shall be routed to avoid passing through node bodies |
| LAYOUT-12 | The router shall support straight, L-bend, and U-bend routing strategies |
| LAYOUT-13 | Edge style shall be carried through from the plan: `solid`, `dashed`, `dotted` |
| LAYOUT-14 | Bidirectional edges shall render with arrowheads at both ends |

---

### 4.4 Themes

| ID | Requirement |
|----|-------------|
| LAYOUT-15 | Three palettes shall be available: `minimal`, `default`, `vibrant` |
| LAYOUT-16 | Theme shall be passed on every `/api/chat` and `/api/ingest` request |
| LAYOUT-17 | Theme shall be applied at the serialisation stage — after positions are computed |
| LAYOUT-18 | The `minimal` theme shall use transparent fills and light strokes only |

---

## 5. Document Ingestion Requirements

| ID | Requirement |
|----|-------------|
| INGEST-01 | `POST /api/ingest` shall accept `content` (string), `filename` (optional), and `semanticState` (optional) |
| INGEST-02 | `content` shall be at least 10 characters |
| INGEST-03 | `content` shall be at most 12,000 characters |
| INGEST-04 | `filename` shall match `/^[\w\-. ]+$/` if provided |
| INGEST-05 | Content containing prompt injection patterns (`"ignore previous instructions"`, `"disregard"`, `"system prompt"`) shall be rejected with HTTP 400 |
| INGEST-06 | The ingest endpoint shall use a separate system prompt (`INGEST_PROMPT`) optimised for document structure |
| INGEST-07 | Only the `plan_diagram` tool shall be available during ingest — `fetch_images` shall not be called |
| INGEST-08 | The request shall timeout after 30 seconds |

**Edge Cases:**
- File larger than 50 KB: rejected client-side before upload; server limit is 12,000 chars as a second guard
- Binary file pasted as text: content type detection falls back to `freeform` layout
- Content is exactly at the 12,000-char limit: accepted; content truncated server-side to prevent overshooting

---

## 6. Voice Input Requirements

| ID | Requirement |
|----|-------------|
| VOICE-01 | Voice input shall use the browser-native `SpeechRecognition` API — no server-side transcription |
| VOICE-02 | The system shall operate with `continuous: true` and `interimResults: true` |
| VOICE-03 | Interim transcripts shall be displayed in real time in the CommandBar |
| VOICE-04 | After a `isFinal: true` result, a 600ms auto-submit timer shall start |
| VOICE-05 | Pressing Escape or clicking the mic button shall cancel the session and clear the transcript |
| VOICE-06 | If `SpeechRecognition` is not available in the browser, the mic button shall be hidden |

---

## 7. Drawing Management Requirements

### 7.1 Save & Auto-Save

| ID | Requirement |
|----|-------------|
| DRAW-01 | A drawing shall be saved with a title (max 100 chars), up to 10 tags, and an optional folder assignment |
| DRAW-02 | A base64 PNG thumbnail (max 400px) shall be generated and stored on every save |
| DRAW-03 | Auto-save shall fire 3 seconds after any canvas change |
| DRAW-04 | Auto-save shall only run if the drawing already has a MongoDB `_id` — it shall never silently create a new document |
| DRAW-05 | Manual save and auto-save shall both create a `DrawingVersion` snapshot |

---

### 7.2 Version History

| ID | Requirement |
|----|-------------|
| DRAW-06 | Each save shall create a `DrawingVersion` with an incrementing `versionNumber` per drawing |
| DRAW-07 | A maximum of 20 versions shall be retained per drawing |
| DRAW-08 | When the 21st version is created, the version with the lowest `versionNumber` shall be deleted |
| DRAW-09 | Version labels shall be auto-generated from the last user chat message, truncated to 40 characters |
| DRAW-10 | Restoring a version shall replace the current `sceneJson` and `conversationHistory` in both the client state and MongoDB |

---

### 7.3 Folders

| ID | Requirement |
|----|-------------|
| DRAW-11 | A user may create folders with a name (max 50 chars) and a hex colour |
| DRAW-12 | Folder name and colour shall be independently updatable |
| DRAW-13 | Deleting a folder shall move all contained drawings to unfiled (`folderId: null`) — drawings shall not be deleted |

---

### 7.4 Sharing

| ID | Requirement |
|----|-------------|
| DRAW-14 | A share link shall be generated by creating a nanoid `shareId` on the drawing and setting `isPublic: true` |
| DRAW-15 | The public share endpoint (`GET /api/share/:shareId`) shall require no authentication |
| DRAW-16 | The share view shall expose only `title` and `sceneJson` — conversation history shall not be included |
| DRAW-17 | If the drawing is unsaved when the user clicks Share, the system shall auto-save first |
| DRAW-18 | Calling the share endpoint again on an already-shared drawing shall return the existing `shareId` without generating a new one |

---

## 8. Visual Feedback Loop Requirements

| ID | Requirement |
|----|-------------|
| CRITIQUE-01 | After every successful diagram render, the client shall export the canvas as a PNG via `exportToBlob()` |
| CRITIQUE-02 | The PNG shall be sent (base64-encoded) to `POST /api/critique` along with `lastPlan` |
| CRITIQUE-03 | The vision model shall check for: text overflow, overlapping nodes, unreadable labels, disconnected edges |
| CRITIQUE-04 | If no issues are found, no changes shall be made to the canvas |
| CRITIQUE-05 | If issues are found, `runCorrectionPass()` shall re-run the layout AI with a targeted fix prompt |
| CRITIQUE-06 | The correction pass shall use the original `DiagramPlan` as context — the AI shall fix only the identified problems |
| CRITIQUE-07 | If the critique or correction pass fails for any reason, the original canvas shall be preserved |
| CRITIQUE-08 | The entire visual feedback loop shall run in the background and shall not block or delay the primary chat response |
| CRITIQUE-09 | The user shall be able to toggle auto-correct via the eye icon in the canvas toolbar |
| CRITIQUE-10 | The toggle preference shall be persisted in `localStorage` |

**Edge Cases:**
- Vision model returns `hasIssues: true` but correction pass produces the same layout: corrected scene still applied — no infinite loop as correction only runs once per chat response
- `exportToBlob()` fails (canvas empty): critique silently skipped
- Network error on `POST /api/critique`: fails silently, original canvas unchanged

---

## 9. Semantic State Requirements

| ID | Requirement |
|----|-------------|
| SEM-01 | The client shall maintain a `semanticState` object tracking: domain, diagramType, established entities, layout conventions, open threads, and turn count |
| SEM-02 | `semanticState` shall be sent on every `/api/chat` and `/api/ingest` request |
| SEM-03 | The server shall inject the current semantic state into the AI system prompt |
| SEM-04 | The server shall return an updated `semanticState` in every chat response |
| SEM-05 | `semanticState` shall be saved to MongoDB alongside `sceneJson` on every save |
| SEM-06 | When a saved drawing is loaded, `semanticState` shall be restored to the client |
| SEM-07 | A null or missing `semanticState` on the request shall be treated as an empty initial state |

---

## 10. Security Requirements

| ID | Requirement |
|----|-------------|
| SEC-01 | `helmet()` shall be applied as the first middleware — before CORS and all route handlers |
| SEC-02 | CORS shall only allow origins listed in the `CLIENT_URL` environment variable |
| SEC-03 | All request bodies shall be sanitised by `express-mongo-sanitize` to strip `$` and `.` keys |
| SEC-04 | `/api/chat` shall be rate-limited to 10 requests per minute per IP |
| SEC-05 | All `/api/auth/*` routes shall be rate-limited to 10 requests per 15 minutes per IP |
| SEC-06 | Input to all routes shall be validated against a Zod schema before any business logic executes |
| SEC-07 | Document ingest content matching prompt injection patterns shall be rejected with HTTP 400 |
| SEC-08 | Image fetch URLs shall be validated before any server-side HTTP request to prevent SSRF |
| SEC-09 | JWT secrets shall be validated as present and non-empty at server startup; the process shall exit if missing |
| SEC-10 | No PII (email addresses, passwords, tokens) shall appear in structured log output |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Diagram generation (p95) | < 5 seconds from message submission to canvas update |
| Page load (initial, cold) | < 2 seconds on a standard broadband connection |
| Auto-save | Non-blocking; fires 3 seconds after scene change without interrupting the user |
| Visual feedback loop | Completes in the background; does not delay primary diagram display |
| Intent detection | < 1 millisecond (client-side regex) |

---

### 11.2 Reliability

| Requirement | Detail |
|-------------|--------|
| AI call retry | 3 attempts with exponential backoff on 429, 503, and timeout |
| AI call timeout | 25 seconds for chat; 30 seconds for ingest |
| Feedback loop resilience | Critique and correction failures are silenced — original canvas always preserved |
| MCP connection | Initialised once at startup; errors logged but do not crash the server |
| Database connection | Mongoose reconnects automatically on transient connection loss |

---

### 11.3 Compatibility

| Requirement | Detail |
|-------------|--------|
| Browser support | Chrome 90+, Edge 90+, Safari 15+, Firefox 90+ |
| Voice input | Chrome, Edge, Safari (Web Speech API) |
| Device | Desktop and laptop browsers; mobile not supported at this scope |
| Screen resolution | Minimum 1280 × 720 |

---

### 11.4 Scalability (Current Scope)

| Requirement | Detail |
|-------------|--------|
| Deployment | Single-instance Express server on Render free tier |
| Concurrency | Handles multiple simultaneous users via Node.js async I/O |
| Horizontal scaling | Stateless server design — ready for load balancing without code changes |
| Database | MongoDB Atlas free tier; sufficient for internship demo scale |

---

### 11.5 Observability

| Requirement | Detail |
|-------------|--------|
| Request IDs | Every request tagged with a UUID for log correlation |
| Structured logging | All log entries are JSON with: level, event name, requestId, userId, durationMs |
| Key events logged | Chat completions, ingest completions, injection attempts, layout errors, token budget events, Groq retries |
| No PII in logs | Email addresses, passwords, and tokens are never written to log output |
