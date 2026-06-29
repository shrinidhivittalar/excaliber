# Excaliber — Phase Scope & Roadmap

**Version**: 1.0  
**Last Updated**: June 2026

---

## Overview

Excaliber was delivered across **10 phases**, each shipping a cohesive slice of functionality. Phases 1–3 established the foundation. Phases 4–9 built out the feature set incrementally. Phase 10 hardened security for production.

```
Phase 1:    Project Foundation & Canvas Setup
Phase 2:    Basic AI Chat → Diagram
Phase 3:    Authentication (JWT)
Phase 4:    Layout Engine v1 (7 algorithms, themes, edge routing)
Phase 5:    Document Ingestion
Phase 6:    Voice Input & UI Overhaul
Phase 7:    Drawing Management (save, folders, versions, sharing)
Phase 8:    Dashboard & CommandBar Unification
Phase 9:    Canvas Polish & AI Enhancements
  9.0.1     CommandBar & auto-hide topbar
  9.0.2     Real-world image embedding (Pexels)
  9.0.3     Visual feedback loop (critique + auto-correct)
  9.0.4     Conversation semantic state
  9.0.5     SSE streaming stages + forgot password
Phase 10:   Security Hardening
```

---

## Phase 1 — Project Foundation & Canvas Setup

**Goal**: Monorepo, dev tooling, Excalidraw canvas, and Express backend running locally.

### Deliverables

#### Infrastructure & Tooling
- [x] Monorepo workspace: `client/` (Vite + React) + `server/` (Express + TypeScript)
- [x] TypeScript configured across client and server
- [x] Tailwind CSS + shadcn/ui installed and themed
- [x] ESLint, Prettier configured
- [x] `npm run dev` starts both client and server concurrently from root

#### Frontend
- [x] Vite project bootstrapped with React 18 and TypeScript
- [x] Excalidraw library integrated and rendering on screen
- [x] Basic page layout: canvas takes full viewport

#### Backend
- [x] Express 5 server with TypeScript
- [x] MongoDB connection via Mongoose
- [x] `GET /api/health` endpoint returning `{ status: "ok" }`
- [x] Excalidraw MCP client initialised (stdio transport)

### Success Criteria
- Canvas renders in the browser
- `GET /api/health` returns 200
- MongoDB connection established on startup

---

## Phase 2 — Basic AI Chat → Diagram

**Goal**: User can type a message and get an AI-generated Excalidraw diagram.

### Deliverables

#### Backend
- [x] `POST /api/chat` — accepts message and history, returns AI reply + sceneJson
- [x] Groq SDK integrated (`llama-4-maverick-17b-128e-instruct`)
- [x] `plan_diagram` tool schema defined and registered
- [x] `runToolLoop()` — drives the LLM until tool calls are exhausted or reply returned
- [x] `planToExcalidrawElements()` — first version (flat positioning, no layout algorithm)
- [x] MCP `create_view` called after layout to update canvas
- [x] System prompt v1

#### Frontend
- [x] Chat input at the bottom of the screen
- [x] Message sent on Enter key
- [x] AI response displayed as text
- [x] `applySceneToCanvas()` — applies returned sceneJson to Excalidraw

### Success Criteria
- Type "draw a flowchart of login" → diagram appears on canvas

---

## Phase 3 — Authentication (JWT)

**Goal**: Register/login flow with JWT access tokens and httpOnly refresh cookies. All drawing routes protected.

### Deliverables

#### Backend
- [x] `User` model (email, hashedPassword, timestamps)
- [x] `RefreshToken` model with TTL index
- [x] `POST /api/auth/register` — email validation, bcrypt hash (12 rounds)
- [x] `POST /api/auth/login` — bcrypt compare, issue JWT + refresh cookie
- [x] `POST /api/auth/refresh` — rotate refresh token, issue new access token
- [x] `POST /api/auth/logout` — delete refresh token, clear cookie
- [x] `GET /api/auth/me` — return current user
- [x] `requireAuth` middleware — verify JWT, attach `req.userId`
- [x] `validateEnv()` — exit on startup if JWT secrets missing
- [x] `tokens.ts` — signAccessToken, verifyAccessToken, createRefreshToken, rotateRefreshToken
- [x] All `/api/chat`, `/api/drawings`, `/api/folders` routes protected with `requireAuth`

#### Frontend
- [x] Login page (`/login`)
- [x] Register page (`/register`)
- [x] Token stored in memory (not localStorage)
- [x] Axios interceptor: silent token refresh on 401; redirect to login if refresh fails
- [x] Route guards: unauthenticated users redirected to `/login`

### Success Criteria
- Register → login → see protected routes
- Refresh token persists across page reload
- Logout clears cookie and redirects to login

---

## Phase 4 — Layout Engine v1

**Goal**: Replace flat positioning with a proper server-side layout engine. 7 algorithms, 3 themes, smart edge routing.

### Deliverables

#### Layout Engine (`server/src/ai/layout/`)
- [x] `validation.ts` — Zod schema for DiagramPlan; `validateAndFixPlan()` auto-repairs missing IDs, duplicate edges, unknown sizes
- [x] `sizing.ts` — node dimensions per size field (xs → xl)
- [x] `themes.ts` — 3 colour palettes: `minimal`, `default`, `vibrant`
- [x] `edge-router.ts` — straight, L-bend, U-bend routing; obstacle avoidance
- [x] `converter.ts` — ComputedLayout → Excalidraw element objects; cameraUpdate prepend
- [x] `algorithms/flowchart.ts` — top-to-bottom sequential with lane assignment
- [x] `algorithms/hierarchy.ts` — BFS from root, level-by-level positioning
- [x] `algorithms/circular.ts` — equal angular distribution
- [x] `algorithms/comparison.ts` — N-column matrix layout
- [x] `algorithms/timeline.ts` — horizontal chronological with alternating labels
- [x] `algorithms/mindmap.ts` — central node with radial branches
- [x] `algorithms/freeform.ts` — force-directed clustering
- [x] `index.ts` — orchestrator: validate → runLayout → computedLayoutToExcalidraw

#### AI Integration
- [x] `plan_diagram` tool schema updated (shape, size, group, sublabel, emphasis, edge styles)
- [x] System prompt updated to guide layout type selection
- [x] Merge mode: passes existing element positions to algorithm to prevent collisions
- [x] `LayoutError` with `stage` field (validation / layout / serialization) fed back to LLM

#### Frontend
- [x] Theme selector in canvas toolbar (minimal / default / vibrant)
- [x] Theme passed on every `/api/chat` request

### Success Criteria
- "Draw an org chart" → proper tree layout
- "Draw a TCP handshake" → flowchart with correct direction
- "Add a Redis layer" → merge mode preserves existing nodes

---

## Phase 5 — Document Ingestion

**Goal**: Users can paste or drop code/markdown/JSON/CSV and get a diagram from its structure.

### Deliverables

#### Backend
- [x] `POST /api/ingest` — accepts content, filename, optional semanticState
- [x] Input validation: min 10 / max 12,000 chars; filename pattern check
- [x] Prompt injection detection: blocks requests with `"ignore previous instructions"` patterns (HTTP 400)
- [x] `INGEST_PROMPT` — separate system prompt optimised for document structure extraction
- [x] `processIngest()` — runs tool loop with `plan_diagram` only (no `fetch_images`)
- [x] `userRateLimit` middleware applied

#### Frontend
- [x] File ingest panel (paperclip button in CommandBar)
- [x] `FileReader` reads uploaded file, truncates at 12,000 chars
- [x] Content type detection from file extension:
  - `.ts/.tsx/.js/.jsx/.py/.go` → code → suggests hierarchy
  - `.md/.mdx` → markdown → suggests mindmap
  - `.json/.yaml/.yml` → data → suggests hierarchy
  - `.csv` → csv → suggests comparison
- [x] Type badge and layout suggestion shown before submit
- [x] Same stage animation as chat
- [x] Analysis comment appended to conversation

### Success Criteria
- Upload a TypeScript file → component/module hierarchy diagram
- Paste a README → mindmap of key sections
- Upload a CSV → comparison layout

---

## Phase 6 — Voice Input & UI Overhaul

**Goal**: Voice-to-diagram support. Full UI design system applied.

### Deliverables

#### Voice Input
- [x] Mic button in CommandBar
- [x] `SpeechRecognition` API (browser-native, no server round-trip)
- [x] Interim transcripts displayed in real time
- [x] 600ms auto-submit timer after final transcript
- [x] Esc or mic-click to cancel
- [x] Supported: Chrome, Edge, Safari

#### UI Overhaul
- [x] Indigo accent colour system (`#6366f1`)
- [x] Frosted glass panels (`backdrop-blur`) on CommandBar and panels
- [x] Dashboard: dot-grid background pattern, spotlight hover cards
- [x] Canvas topbar: auto-hides on idle, revealed on hover or keyboard focus
- [x] Loading states: cycling stage labels ("Thinking..." → "Asking AI..." → "Placing on canvas...")
- [x] Prompt chip suggestions in CommandBar (example prompts)
- [x] Intent pill: appears above CommandBar for 3s when intent is detected

### Success Criteria
- Speak "draw a binary search tree" → diagram generated
- Silence for 600ms auto-submits the transcript
- Press Esc cancels voice without submitting

---

## Phase 7 — Drawing Management

**Goal**: Persist drawings to MongoDB. Version history, folders, tags, sharing, thumbnails.

### Deliverables

#### Backend
- [x] `Drawing` model (title, sceneJson, conversationHistory, userId, shareId, isPublic, folderId, tags, thumbnail)
- [x] `DrawingVersion` model with compound index `{drawingId, versionNumber}`
- [x] `Folder` model
- [x] `GET /api/drawings` — list with optional folder and search filter
- [x] `POST /api/drawings` — create
- [x] `GET /api/drawings/:id` — load full drawing
- [x] `PATCH /api/drawings/:id` — update (save), creates version snapshot
- [x] `POST /api/drawings/:id/share` — generate nanoid shareId, set isPublic
- [x] `GET /api/drawings/:id/versions` — list versions
- [x] `POST /api/drawings/:id/versions/:versionId/restore` — restore snapshot
- [x] `GET /api/folders`, `POST /api/folders`, `PATCH /api/folders/:id`, `DELETE /api/folders/:id`
- [x] `GET /api/share/:shareId` — public read-only (no auth)
- [x] `versions.ts` service — snapshot creation + max-20 pruning
- [x] `tokenBudget.ts` service — per-user daily token limit

#### Frontend
- [x] Dashboard page (`/dashboard`) — drawing cards, folder sidebar, search bar
- [x] Canvas topbar: title input, folder/tag assignment, save, share, copy PNG, undo, versions
- [x] Auto-save: debounced 3s after scene change (only if drawing has an ID)
- [x] Version history panel: list versions, restore with confirmation
- [x] Single-level undo via `prevSceneRef`
- [x] Share flow: auto-saves if unsaved, copies URL to clipboard
- [x] Thumbnail generation via `exportToBlob()` on save

### Success Criteria
- Save a drawing → appears in dashboard
- Reload page → drawing and conversation restored
- Restore version → canvas reverts to snapshot
- Share link → public canvas view with no auth

---

## Phase 8 — Dashboard & CommandBar Unification

**Goal**: Unified CommandBar (chat + voice + file in one component), dashboard polish, node interaction panel.

### Deliverables

#### Frontend
- [x] `CommandBar.tsx` unified: text input, mic, paperclip, theme selector all in one component
- [x] `NodePanel.tsx` — slides in when user clicks a labelled Excalidraw shape
  - "Explain this" → auto-sends "Explain [NodeName]" to chat
  - "Drill down" → auto-sends "Drill down into [NodeName]" in merge mode
  - "Related concepts" → auto-sends contextual prompt
- [x] Dashboard search: full-text across title and tags
- [x] Dashboard tag filter pills
- [x] `detectIntent()` in `lib/detectIntent.ts` — 5 intent patterns (regex-based, client-side, < 1ms)
- [x] Canvas element count warning at > 200 elements

#### Backend
- [x] `POST /api/images` — Pexels proxy with SSRF-safe URL validation
- [x] `fetch_images` tool added to tool registry
- [x] System prompt updated for `show_me` intent: fetch images before drawing

### Success Criteria
- Click a node → NodePanel appears with contextual actions
- "Show me a human heart" → Pexels image embedded on canvas with annotation ring
- Intent pill shown for wireframe/system_design/show_me messages

---

## Phase 9 — Canvas Polish & AI Enhancements

**Goal**: Four targeted enhancements to AI quality, UX polish, and resilience.

### Phase 9.0.1 — Auto-hide Topbar & CommandBar Cleanup

**Goal**: Remove visual clutter; topbar hides when idle.

- [x] Canvas topbar auto-hides after 3s idle; re-appears on hover or keyboard focus
- [x] CommandBar visual polish: frosted glass, rounded pill, shadow
- [x] Stage animation cleanup: consistent label sequence across chat and ingest
- [x] Request ID middleware for log correlation

---

### Phase 9.0.2 — Real-World Image Embedding

**Goal**: "show me [a real subject]" fetches an actual Pexels photo and embeds it on canvas.

- [x] Server downloads image binary (capped 150 KB), converts to base64
- [x] Base64 image returned in `embeddedImages[]` array on chat response
- [x] Client calls `excalidrawAPI.addFiles()` to register the image asset
- [x] Image placed at canvas centre as an Excalidraw image element
- [x] Annotation nodes arranged radially around the image with dashed inward-pointing arrows
- [x] "Photo: Pexels" credit text node below image
- [x] `system_prompt` updated: instructs model to call `fetch_images` for real-world subjects

---

### Phase 9.0.3 — Visual Feedback Loop (Critique + Auto-Correct)

**Goal**: After every diagram, a vision model reviews the PNG and silently corrects layout issues.

- [x] `vision.ts` — `critiqueImage(imageBase64)` via `llama-4-scout-17b-16e-instruct`
  - Checks: text overflow, overlapping nodes, unreadable labels, disconnected edges
  - Returns `{ hasIssues: boolean, issues: string[] }`
  - Catch block always returns `{ hasIssues: false }` — never blocks user
- [x] `POST /api/critique` route — receives PNG + lastPlan, runs critique, runs correction pass
- [x] `runCorrectionPass(issues, originalPlan, currentSceneJson)` in `groq.ts`
  - Builds a targeted prompt from issues list
  - Re-runs `runToolLoop()` constrained to fix only the identified problems
  - Returns corrected sceneJson or null on failure
- [x] Frontend: `runVisualFeedback()` fires in background after every `sendMessage()`
  - 500ms wait → `exportToBlob()` → POST /api/critique
  - If corrected: `applySceneToCanvas()`, toast "✓ Auto-corrected" for 4s
  - `autoCorrectRef` used (not state) to avoid stale closure bug in async callback
- [x] Eye icon in topbar toggles auto-correct; preference in localStorage

---

### Phase 9.0.4 — Conversation Semantic State

**Goal**: AI maintains structured context across turns — no need to re-describe prior state.

- [x] `semanticState` object defined (domain, diagramType, entities, layoutConvention, openThreads, turnCount)
- [x] Client sends `semanticState` on every `/api/chat` and `/api/ingest` request
- [x] Server injects current state into generation prompt
- [x] Server updates state based on what was classified and drawn, returns updated state
- [x] Client stores updated `semanticState` in hook state
- [x] `semanticState` saved to MongoDB alongside `sceneJson` on every save
- [x] Restored from MongoDB when a saved drawing is loaded

---

### Phase 9.0.5 — SSE Streaming Stages & Forgot Password

**Goal**: Stream diagram generation stages in real time. Add secure password reset flow.

#### SSE Stages
- [x] Stage labels streamed via Server-Sent Events as Groq processes the request
- [x] Client displays cycling stage text in CommandBar during loading
- [x] Stages include: "Thinking..." → "Asking AI..." → "Planning diagram..." → "Placing on canvas..."
- [x] Falls back gracefully if SSE connection fails

#### Forgot Password
- [x] `PasswordResetToken` model — stores SHA-256 hash of token with 1-hour TTL
- [x] `POST /api/auth/forgot-password` — always returns 200; emails reset link if email exists
- [x] `POST /api/auth/reset-password` — verifies hashed token, updates bcrypt hash, deletes record
- [x] `email.ts` service — sends reset email via nodemailer (SMTP)
- [x] Forgot password page (`/forgot-password`)
- [x] Reset password page (`/reset-password?token=<raw>`)
- [x] Existing reset tokens for the user deleted before creating a new one

---

## Phase 10 — Security Hardening

**Goal**: Production-grade security controls across the full stack.

### Deliverables

#### New Controls
- [x] `helmet()` added as first middleware — sets 11 HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.)
- [x] `express-mongo-sanitize` — strips `$` and `.` from all request bodies; prevents NoSQL injection
- [x] `authLimiter` — 10 requests per 15 minutes on all `/api/auth/*` routes; blocks brute-force login and account enumeration

#### Fixes
- [x] Prompt injection on `/api/ingest` now returns HTTP 400 (previously only logged)
- [x] Weak JWT fallback secrets (`|| "fallback-access-secret"`) removed — `validateEnv()` already exits the process if secrets are missing, making the fallback dead code; removed to eliminate ambiguity

### Security Checklist (Final State)

| Control | Status |
|---------|--------|
| HTTP security headers (helmet) | PRESENT |
| CORS whitelist | PRESENT |
| Auth endpoint rate limiting | PRESENT |
| Chat endpoint rate limiting | PRESENT |
| Per-user rate limiting | PRESENT |
| NoSQL injection prevention | PRESENT |
| JWT secrets validated at startup | PRESENT |
| No weak fallback secrets | PRESENT |
| bcrypt 12 rounds | PRESENT |
| httpOnly refresh cookies | PRESENT |
| Refresh token rotation | PRESENT |
| Input validation (Zod) on all routes | PRESENT |
| Prompt injection blocked on ingest | PRESENT |
| Canvas / enum whitelist | PRESENT |
| SSRF prevention (images) | PRESENT |
| Token budget enforcement | PRESENT |
| Version cap (storage lifecycle) | PRESENT |
| Password reset token hashing (SHA-256) | PRESENT |

### Success Criteria
- `npm audit` shows no new vulnerabilities introduced in Phase 10
- `curl -I https://your-backend.onrender.com/api/health` shows security headers in response
- Login attempt with 11+ requests in 15 minutes → 429 response
- Document ingest with "ignore previous instructions" → 400 response
