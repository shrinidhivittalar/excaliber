# Excaliber — System Architecture Documentation

**Version**: 1.0  
**Last Updated**: June 2026

---

## 1. Architecture Overview

Excaliber follows a **client-server architecture** with a clear separation between the React frontend, an Express REST API, a custom AI orchestration layer, a server-side layout engine, and MongoDB for persistence. The system is deployed on Vercel (frontend) and Render (backend).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  React 18 + Vite (TypeScript)                               │   │
│   │  Deployed on Vercel                                         │   │
│   │                                                             │   │
│   │  /dashboard    /canvas/:id    /share/:shareId               │   │
│   │  /login        /register      /forgot-password              │   │
│   └──────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                               │  HTTPS / REST
┌─────────────────────────────┼───────────────────────────────────────┐
│                             │   API LAYER                           │
│   ┌─────────────────────────▼──────────────────────────────────┐    │
│   │  Express 5 + TypeScript                                    │    │
│   │  Deployed on Render                                        │    │
│   │                                                            │    │
│   │  Middleware stack:                                         │    │
│   │    helmet → cors → requestId → json → cookieParser         │    │
│   │    → mongoSanitize → authLimiter / chatLimiter             │    │
│   │    → requireAuth → userRateLimit                           │    │
│   │                                                            │    │
│   │  Routes:                                                   │    │
│   │    /api/auth     /api/drawings    /api/folders             │    │
│   │    /api/chat     /api/ingest      /api/critique            │    │
│   │    /api/images   /api/share       /api/health              │    │
│   └──────────┬────────────────────────────────────────────────┘    │
│              │                                                       │
│   ┌──────────▼────────────────────────────────────────────────┐    │
│   │  AI ORCHESTRATION LAYER                                   │    │
│   │                                                            │    │
│   │  groq.ts                                                  │    │
│   │    processMessage()  ─────► runToolLoop()                 │    │
│   │    processIngest()   ─────► runToolLoop()                 │    │
│   │    runCorrectionPass() ───► runToolLoop()                 │    │
│   │                                    │                      │    │
│   │                         ┌──────────▼──────────┐          │    │
│   │                         │   Groq API          │          │    │
│   │                         │   llama-3.3-70b     │          │    │
│   │                         │   llama-4-scout-17b │          │    │
│   │                         └──────────┬──────────┘          │    │
│   │                                    │                      │    │
│   │  ┌─────────────────────────────────▼──────────────────┐  │    │
│   │  │  LAYOUT ENGINE  (server/src/ai/layout/)            │  │    │
│   │  │                                                     │  │    │
│   │  │  validateAndFixPlan() → runLayout() → converter()  │  │    │
│   │  │       │                      │                      │  │    │
│   │  │  validation.ts          algorithms/                 │  │    │
│   │  │  (Zod schema)             flowchart.ts              │  │    │
│   │  │                           hierarchy.ts              │  │    │
│   │  │  edge-router.ts           circular.ts               │  │    │
│   │  │  sizing.ts                comparison.ts             │  │    │
│   │  │  themes.ts                timeline.ts               │  │    │
│   │  │  converter.ts             mindmap.ts                │  │    │
│   │  │                           freeform.ts               │  │    │
│   │  └─────────────────────────────────────────────────────┘  │    │
│   └───────────────────────────────────────────────────────────┘    │
│              │                                                       │
│   ┌──────────▼────────────────────────────────────────────────┐    │
│   │  DATA LAYER                                               │    │
│   │                                                           │    │
│   │  MongoDB (Atlas)                                          │    │
│   │    User  |  Drawing  |  DrawingVersion                   │    │
│   │    Folder  |  RefreshToken  |  PasswordResetToken        │    │
│   └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 18 | UI component model |
| Build Tool | Vite 6 | Dev server, hot reload, production bundling |
| Language | TypeScript 5.x | Type safety |
| Canvas | Excalidraw | Interactive whiteboard rendering |
| UI Components | shadcn/ui + Radix UI | Accessible, composable primitives |
| Styling | Tailwind CSS 3 | Utility-first CSS |
| HTTP Client | Fetch API (custom wrapper) | API calls with interceptors for token refresh |
| Auth | Custom hook + interceptor | JWT management, silent refresh, redirect on expiry |

### 2.2 Directory Structure

```
client/src/
├── pages/
│   ├── CanvasPage.tsx          # Canvas page orchestrator
│   ├── DashboardPage.tsx       # Drawing list, folders, search, tags
│   ├── SharePage.tsx           # Public read-only canvas view
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   └── ResetPasswordPage.tsx
│
├── components/
│   ├── CommandBar.tsx          # Pill-bar chat UI: text, voice, file upload
│   ├── CanvasActions.tsx       # Top-right toolbar: save, share, undo, versions
│   ├── NodePanel.tsx           # Explain/drill-down panel on element click
│   └── ui/                     # shadcn/ui generated components
│
├── hooks/
│   └── useDrawingApp.ts        # All app state: chat, scene, save, versions, themes
│
├── lib/
│   ├── api.ts                  # Typed API client (chat, ingest, drawings, auth...)
│   ├── detectIntent.ts         # Client-side intent classifier (regex-based)
│   └── auth.ts                 # Token storage, silent refresh, logout
│
└── types/
    └── index.ts                # Shared TypeScript interfaces and types
```

### 2.3 State Management

All application state is centralised in a single custom hook (`useDrawingApp.ts`) which is consumed by the top-level `CanvasPage`. No external state library is used.

```
useDrawingApp.ts owns:
  ├── messages[]             Chat history (user + assistant + error)
  ├── sceneJson              Current Excalidraw scene
  ├── isLoading              AI request in-flight
  ├── currentDrawingId       MongoDB _id (null = unsaved draft)
  ├── currentTitle           Drawing title
  ├── currentFolderId        Assigned folder
  ├── currentTags[]          Tag list
  ├── theme                  'minimal' | 'default' | 'vibrant'
  ├── canUndo                Whether prevSceneRef is populated
  ├── versions[]             Version snapshot list
  ├── selectedNode           Clicked Excalidraw element
  ├── errorToast             Transient error message (auto-clears 5s)
  ├── semanticState          Conversation semantic context (entities, layout, threads)
  ├── autoCorrectEnabled     Persisted in localStorage
  ├── isCritiquing           Visual feedback in progress
  └── detectedIntent         Intent pill label (clears after 3s)
```

### 2.4 Token Refresh Interceptor

```
API call made
    │
    ├─ [200–299] ──► Return response
    │
    └─ [401 Unauthorized]
              │
              POST /api/auth/refresh (reads httpOnly cookie)
              │
              ├─ [Success] ──► New access token stored
              │                Original request retried once
              │
              └─ [401 again] ──► clearTokens()
                                  Redirect → /login
```

---

## 3. Backend Architecture

### 3.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Framework | Express.js 5 |
| Language | TypeScript 5.x |
| ODM | Mongoose 8 |
| Database | MongoDB 7 (Atlas) |
| AI | Groq SDK (llama-4-maverick-17b-128e-instruct, llama-4-scout-17b) |
| Validation | Zod 3 |
| Auth | jsonwebtoken + bcrypt |
| Security | helmet, express-mongo-sanitize, express-rate-limit |
| Logging | Custom structured JSON logger |
| Canvas Protocol | Excalidraw MCP (vendored) |
| Email | nodemailer |

### 3.2 Directory Structure

```
server/src/
├── index.ts                    # Express app bootstrap, middleware, route mounting
│
├── ai/
│   ├── groq.ts                 # AI orchestration: processMessage, processIngest, runToolLoop
│   ├── vision.ts               # Visual critique: critiqueImage via llama-4-scout
│   ├── systemPrompt.ts         # System prompt + INGEST_PROMPT
│   └── layout/
│       ├── index.ts            # Orchestrator: DiagramPlan → Excalidraw elements
│       ├── converter.ts        # Computed positions → Excalidraw element format
│       ├── edge-router.ts      # Arrow routing: straight, L-bends, U-bends
│       ├── themes.ts           # 3 colour palettes (minimal, default, vibrant)
│       ├── sizing.ts           # Node width/height from size field (xs–xl)
│       ├── validation.ts       # Zod schema: fix missing fields, clamp, dedupe
│       └── algorithms/
│           ├── flowchart.ts    # Top-to-bottom sequential flow
│           ├── hierarchy.ts    # Parent-child trees
│           ├── circular.ts     # Radial layout
│           ├── comparison.ts   # Side-by-side matrix
│           ├── timeline.ts     # Horizontal chronological
│           ├── mindmap.ts      # Hierarchical mind map
│           └── freeform.ts     # Organic clustering
│
├── routes/
│   ├── auth.ts                 # Register, login, refresh, logout, forgot/reset password
│   ├── chat.ts                 # POST /api/chat — main AI chat endpoint
│   ├── ingest.ts               # POST /api/ingest — document to diagram
│   ├── critique.ts             # POST /api/critique — visual feedback loop
│   ├── drawings.ts             # CRUD for drawings
│   ├── versions.ts             # Version list and restore
│   ├── folders.ts              # Folder CRUD
│   ├── share.ts                # Share link generation and public view
│   ├── images.ts               # Pexels image proxy
│   ├── health.ts               # GET /api/health
│   └── clear.ts                # POST /api/clear (legacy MCP canvas reset)
│
├── models/
│   ├── User.ts
│   ├── Drawing.ts
│   ├── DrawingVersion.ts
│   ├── Folder.ts
│   ├── RefreshToken.ts
│   └── PasswordResetToken.ts
│
├── middleware/
│   ├── auth.ts                 # requireAuth: verifies JWT, attaches req.userId
│   ├── requestId.ts            # Attaches a UUID to every request (req.requestId)
│   └── userRateLimit.ts        # Per-user rate limiting (separate from IP limiting)
│
├── auth/
│   └── tokens.ts               # signAccessToken, verifyAccessToken, createRefreshToken, rotateRefreshToken
│
├── services/
│   ├── images.ts               # Pexels API wrapper (SSRF-safe URL validation)
│   ├── versions.ts             # Snapshot creation + max-20 pruning + restoration
│   ├── tokenBudget.ts          # Daily per-user Groq token limit enforcement
│   └── email.ts                # Password reset email via nodemailer
│
├── mcp/
│   └── client.ts               # Excalidraw MCP bridge (stdio transport)
│
├── db/
│   └── connect.ts              # MongoDB connection (Mongoose)
│
└── lib/
    ├── logger.ts               # Structured JSON logger with request ID correlation
    ├── retry.ts                # withRetry (exponential backoff) + withTimeout
    └── validateEnv.ts          # Startup check: exits if required env vars missing
```

### 3.3 Request Lifecycle

```
HTTP Request
    │
    ▼
helmet()               — sets 11 security headers
requestIdMiddleware()  — attaches UUID to req.requestId
cors()                 — checks against CLIENT_URL allowlist
express.json()         — parses body (2 MB limit)
cookieParser()         — parses httpOnly refresh token cookie
mongoSanitize()        — strips $ and . from body keys
    │
    ├── /api/chat       → chatLimiter (10/min) → requireAuth → userRateLimit → chatRoutes
    ├── /api/auth/*     → authLimiter (10/15min) → authRoutes
    ├── /api/drawings/* → requireAuth → userRateLimit → drawingsRoutes / versionsRoutes
    ├── /api/folders/*  → requireAuth → foldersRoutes
    ├── /api/ingest     → requireAuth → userRateLimit → ingestRoutes
    ├── /api/critique   → requireAuth → critiqueRoutes
    ├── /api/images     → imagesRoutes
    ├── /api/share/*    → shareRoutes (public)
    └── /api/health     → healthRoutes (public)
    │
    ▼
Route handler
    │
    ▼
Response
```

---

## 4. AI Pipeline Architecture

### 4.1 Tool Protocol

The AI operates as a **planner, not a renderer**. It declares what the diagram should contain using structured tool calls. The server handles all geometry and canvas updates.

| Tool | Who Calls It | Purpose |
|------|-------------|---------|
| `plan_diagram` | LLM | Declare nodes, edges, groups, layout type, direction, mode |
| `fetch_images` | LLM | Search Pexels for reference images (for `show_me` intent) |
| `create_view` | Server | Low-level MCP call to update the Excalidraw canvas |

### 4.2 plan_diagram Tool Schema

```
{
  layout:     "flowchart" | "hierarchy" | "circular" | "comparison"
              | "timeline" | "mindmap" | "freeform"
  mode:       "replace" (fresh canvas) | "merge" (add to existing)
  direction:  "TB" (top-bottom) | "LR" (left-right)
  nodes[]:
    id        string
    label     string
    shape     "rectangle" | "ellipse" | "diamond" | "text"
    size      "xs" | "s" | "m" | "l" | "xl"
    group     string (optional)
    sublabel  string (optional caption)
    emphasis  boolean (highlighted stroke)
  edges[]:
    from      node id
    to        node id
    label     string (optional)
    style     "solid" | "dashed" | "dotted"
    bidirectional boolean
  groups[]:
    id        string
    label     string
    color     string
}
```

### 4.3 Tool-Calling Loop

```
runToolLoop(messages, tools, ...)
    │
    ▼
[Groq API call] — withRetry(3) + withTimeout(25s)
    │
    ├─ [Plain text reply] ──► Return response (loop exits)
    │
    └─ [tool_calls in response]
              │
              For each tool call:
              │
              ├─ plan_diagram ──► planToExcalidrawElements(args)
              │                        │
              │                        ▼
              │                   validateAndFixPlan(plan)
              │                        │
              │                   runLayout(plan, existingPositions)
              │                        │
              │                   computedLayoutToExcalidraw(layout, theme)
              │                        │
              │                   callMcpTool('create_view', elements)
              │                        │
              │                   Return sceneJson
              │
              ├─ fetch_images ──► searchImages(query) — Pexels API
              │                   Return { url, alt, photographer }
              │
              └─ [other] ──► callMcpTool(toolName, args)
              │
              Push tool result back to messages
              │
              Repeat (max 10 iterations)
```

### 4.4 Canvas Summarisation

Before every chat request, `summarizeScene()` produces a concise text description of the current Excalidraw canvas and injects it as a `[CURRENT CANVAS]` block into the user message. This gives the LLM contextual awareness for merge operations without passing raw JSON.

### 4.5 Semantic State

The client maintains a structured semantic context that is round-tripped on every request:

```
semanticState {
  domain          string          (e.g. "networking", "biology")
  diagramType     string          (e.g. "tcp-handshake")
  entities        { id, label }[] (every drawn node with its scene id)
  layoutConvention {
    layout        string
    direction     string
  }
  openThreads     string[]        (mentioned but not yet drawn)
  turnCount       number
}
```

The server injects the current state into the generation prompt, updates it based on what was drawn, and returns the updated state. No server-side session is required. State is persisted in MongoDB alongside the drawing and restored on load.

---

## 5. Layout Engine Architecture

### 5.1 Pipeline

```
DiagramPlan (from AI tool call)
    │
    ▼
1. validateAndFixPlan(plan)     — Zod schema check
   ├── Fill missing node IDs
   ├── Clamp unknown sizes to 'm'
   ├── Deduplicate edges
   └── Remove edges referencing unknown nodes
    │
    ▼
2. runLayout(plan, existing)    — select and execute algorithm
   ├── Pass existingPositions in merge mode (prevents collisions)
   └── Returns: ComputedLayout { nodes with x,y,w,h; edges }
    │
    ▼
3. computedLayoutToExcalidraw(layout, theme)
   ├── converter.ts:  ComputedLayout → Excalidraw element objects
   ├── themes.ts:     apply colour palette per element type
   ├── edge-router.ts: compute arrow waypoints (straight / L-bend / U-bend)
   └── Prepend cameraUpdate element (canvas auto-fits on render)
    │
    ▼
Excalidraw element JSON array
```

### 5.2 Algorithm Selection

| plan.layout | Algorithm File | Strategy |
|-------------|---------------|----------|
| `flowchart` | `flowchart.ts` | Top-to-bottom lanes; horizontal rank assignment |
| `hierarchy` | `hierarchy.ts` | BFS from root; level-by-level positioning |
| `circular` | `circular.ts` | Equal angular distribution around a centre point |
| `comparison` | `comparison.ts` | N columns; rows aligned across columns |
| `timeline` | `timeline.ts` | Left-to-right chronological; alternating up/down labels |
| `mindmap` | `mindmap.ts` | Central node; radial branches with sub-branches |
| `freeform` | `freeform.ts` | Force-directed clustering with collision avoidance |

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
[Register / Login]
    │
    ▼
bcrypt.hash(password, 12) stored in User.hashedPassword

[On successful login]
    ├── signAccessToken(userId) — JWT, 15 min expiry
    │     Signed with JWT_ACCESS_SECRET (validated present at startup)
    │
    └── createRefreshToken(userId) — nanoid(64) stored in RefreshToken collection
          Set as httpOnly, Secure, SameSite cookie (7 days)

[Authenticated Request]
    │
    requireAuth middleware
    │
    ├── Read Authorization: Bearer <token>
    ├── verifyAccessToken(token) — throws if invalid or expired
    └── Attach req.userId for downstream use

[Token Refresh]
    │
    rotateRefreshToken(oldToken)
    ├── findOneAndDelete({ token: oldToken }) — old token consumed immediately
    ├── Check expiresAt > now
    └── createRefreshToken(userId) — new token issued
```

### 6.2 Defence Layers

| Layer | Measure |
|-------|---------|
| HTTP headers | `helmet()` — CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy |
| CORS | Whitelist-only; checked against `CLIENT_URL` env var |
| Rate limiting | 10/min on chat; 10/15min on auth; per-user via `userRateLimit` middleware |
| Token budget | Daily per-user Groq token limit (default 100,000); logged per request |
| Password hashing | bcrypt 12 rounds |
| Input validation | Zod schemas on every route before any business logic |
| NoSQL injection | `express-mongo-sanitize` strips `$` and `.` from all request bodies |
| Prompt injection | Detected and blocked (HTTP 400) on `/api/ingest` |
| SSRF | Image URLs validated before server-side fetch in `images.ts` |
| JWT secrets | Startup validation exits the process if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing |
| Refresh token storage | httpOnly cookie — not readable by JavaScript |

---

## 7. Deployment Architecture

```
                    ┌────────────────────────────────┐
                    │          GitHub                │
                    │   main branch push triggers    │
                    └───────────────┬────────────────┘
                                    │
               ┌────────────────────┴──────────────────────┐
               │                                            │
       ┌───────▼────────┐                      ┌───────────▼──────────┐
       │    Vercel       │                      │      Render          │
       │  (Frontend)     │                      │    (Backend)         │
       │                 │                      │                      │
       │  npm run build  │                      │  npm install &&      │
       │  (Vite)         │                      │  npm run build &&    │
       │                 │                      │  node dist/index.js  │
       │  client/dist    │                      │                      │
       │  served globally│                      │  PORT: 3001          │
       │  via Vercel CDN │                      │                      │
       └─────────────────┘                      └──────────┬───────────┘
                                                            │
                                                ┌───────────▼───────────┐
                                                │   MongoDB Atlas       │
                                                │   (Managed Cloud DB)  │
                                                └───────────────────────┘
```

### 7.1 Environment-Specific Behaviour

| Setting | Development | Production |
|---------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| Cookie `Secure` | false | true |
| Cookie `SameSite` | `lax` | `none` |
| CORS origin | localhost:5173 | `CLIENT_URL` env var |
| Logging | Console + structured JSON | Structured JSON only |

---

## 8. Observability

### 8.1 Logging

Every log entry includes:

```json
{
  "level": "info",
  "event": "chat_request",
  "requestId": "uuid-per-request",
  "userId": "mongo-object-id",
  "durationMs": 1843,
  "tokensUsed": 1204,
  "layout": "flowchart",
  "toolsUsed": ["plan_diagram"]
}
```

No PII (emails, passwords, tokens) is written to logs.

### 8.2 Key Events Logged

| Event | Level | When |
|-------|-------|------|
| `chat_request` | info | Every `POST /api/chat` completion |
| `ingest_request` | info | Every `POST /api/ingest` |
| `ingest_injection_attempt` | warn | Prompt injection pattern detected |
| `layout_error` | error | Layout engine throws `LayoutError` |
| `groq_retry` | warn | Groq call being retried |
| `token_budget_exceeded` | warn | User over daily token limit |
| `password_reset_email_sent` | info | Reset email dispatched |
| `password_reset_email_failed` | error | SMTP failure |
| `pexels_missing` | warn | `PEXELS_API_KEY` not set at startup |
