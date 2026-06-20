# Excaliber — Product Requirements Document


## 1. Executive Summary

Excaliber is a full-stack AI-powered diagramming engine that converts natural language into structured, properly laid-out visual diagrams on an interactive canvas. Users describe what they want to visualise — a system architecture, a biological concept, a code structure, a process flow — and the AI produces a complete diagram in seconds.

Unlike traditional diagramming tools where users manually place and connect every shape, Excaliber handles all positioning, sizing, and routing automatically through a custom server-side layout engine. The user's only job is to describe the idea.

---

## 2. Problem Statement

Existing diagramming tools (Lucidchart, draw.io, Miro) require users to:

- Manually drag, place, and connect every shape on the canvas
- Spend significant time on layout rather than content
- Possess design intuition to make diagrams readable
- Rebuild diagrams from scratch when concepts change

This creates friction for developers, students, and researchers who need to quickly visualise technical concepts but do not want to spend time on visual formatting.

**Excaliber eliminates this friction.** You describe the concept; the engine draws it.

---

## 3. Target Users

| User Type | Primary Use Case |
|-----------|-----------------|
| Software Engineers | System architecture, API flowcharts, microservice maps, code structure |
| Students | Concept maps, biology diagrams, history timelines, process flows |
| Technical Architects | Infrastructure diagrams, decision trees, component breakdowns |
| Product Teams | User flow wireframes, feature comparison charts |
| Researchers | Document structure visualisation, note maps, relationship diagrams |

---

## 4. Functional Requirements

### 4.1 Natural Language Diagram Generation

The system shall accept a text prompt from the user, interpret intent, select the appropriate layout algorithm, and render a fully positioned diagram on the canvas.

**Acceptance Criteria:**
- Prompt to rendered diagram in under 5 seconds on average
- AI selects correct layout type for the described concept
- Follow-up prompts (`"add a Redis layer"`) merge correctly into existing canvas
- System maintains conversational context across turns without re-describing prior state
- Canvas content is summarised and injected into each request for contextual awareness

**Supported Intents:**

| Intent | Trigger Example | System Behaviour |
|--------|----------------|-----------------|
| `show_me` | "show me a human heart" | Fetches Pexels image first, annotates with nodes |
| `wireframe` | "wireframe the login page" | Switches theme to `minimal` for this request only |
| `system_design` | "system design for Twitter" | Uses 5-layer architecture layout |
| `annotate` | "annotate this diagram" | Merge mode, adds `ann_` prefix text nodes |
| `refine` | "clean this up" | Adjusts sizing and layout without full redraw |

### 4.2 Layout Engine

The server-side layout engine shall compute all element positions. The AI outputs a semantic plan; the engine handles all geometry.

**Seven Layout Algorithms:**

| Algorithm | Best For |
|-----------|---------|
| `flowchart` | Sequential processes, request flows, pipelines |
| `hierarchy` | Trees, org charts, code module imports |
| `circular` | Life cycles, ring structures, recurring processes |
| `comparison` | Side-by-side tables, pros/cons, matrix views |
| `timeline` | Events over time, roadmaps, historical sequences |
| `mindmap` | Concepts radiating from a central idea, brainstorming |
| `freeform` | Annotated images, anatomy diagrams, unconstrained layouts |

**Edge Routing:**
- Arrows route around node obstacles automatically
- Supports straight, L-bend, and U-bend routing strategies
- Bidirectional edges supported
- Edge styles: solid, dashed, dotted

### 4.3 Document Ingestion

The system shall accept text-based file content, detect its type, and generate an appropriate diagram from its structure.

**Supported Input Types:**

| Input Type | Auto-Detected Layout |
|------------|---------------------|
| `.ts`, `.js`, `.py`, `.go` (source code) | Hierarchy |
| `.md` / README | Mindmap |
| `.json`, `.yaml`, `.yml` | Hierarchy |
| `.csv` | Comparison |
| Plain prose / notes | Mindmap |

**Constraints:**
- Maximum file size: 50 KB (client-side check)
- Maximum content processed: 12,000 characters (truncated at server)
- Filename used to provide type hint to the AI

### 4.4 Voice Input

The system shall accept voice input as an alternative to text entry.

**Acceptance Criteria:**
- Uses browser-native Web Speech API — no server-side transcription
- Supported browsers: Chrome, Edge, Safari
- Interim transcripts displayed in real time during speech
- Final transcript auto-submitted 600 ms after the last recognised word
- Press Escape or click the mic button again to cancel

### 4.5 Visual Themes

Three visual themes shall apply globally across all layouts:

| Theme | Character |
|-------|-----------|
| `minimal` | Transparent fills, light strokes, wireframe aesthetic — default for wireframe intent |
| `default` | Soft pastel palette (blue, green, yellow, pink, purple) |
| `vibrant` | Saturated colours, bold strokes, high contrast |

Theme is persisted in `localStorage` and applied to all subsequent diagrams until changed.

### 4.6 Visual Feedback Loop (Auto-Correct)

After every diagram is rendered, the system shall:

1. Export the canvas as a PNG using Excalidraw's `exportToBlob()` API
2. Send the PNG (base64-encoded) to `POST /api/critique`
3. Pass it to a vision model (`llama-4-scout-17b`) to detect layout issues
4. If issues are found, run a targeted correction pass and silently update the canvas
5. Display a brief "Auto-corrected" indicator to the user

**Failure behaviour:** If the critique or correction pass fails, the original diagram is preserved. The feedback loop never blocks the primary response.

**Toggle:** User can disable auto-correct via the eye icon in the canvas toolbar. Preference is persisted in `localStorage`.

### 4.7 Drawing Management

| Feature | Specification |
|---------|--------------|
| Save | Create or update a drawing with title, tags (max 10), and folder assignment |
| Auto-save | Triggered 3 seconds after any canvas change (debounced). Only fires if a drawing ID exists — will not silently create new documents |
| Version history | Automatic snapshot on every save; max 20 per drawing (oldest pruned); restorable in one click |
| Folders | Create, rename, recolour, and delete named collections; drawings assigned to folders |
| Tags | Full-text search across titles and tags |
| Sharing | Generate a public read-only link per drawing. Revocable |
| Thumbnail | Base64 PNG (max 400px) generated on save; displayed in dashboard |
| Undo | Single-level undo of the last AI-generated change |

### 4.8 Authentication

| Feature | Specification |
|---------|--------------|
| Registration | Email + password. Validated at both client and server |
| Login | Email + password with bcrypt verification |
| Access token | JWT, 15-minute expiry, sent in `Authorization: Bearer` header |
| Refresh token | Random 64-char token, stored in MongoDB; delivered via `httpOnly` cookie |
| Token rotation | Refresh token replaced on every use; old token deleted |
| Password reset | SHA-256-hashed reset token emailed via SMTP; expires after 1 hour |
| Forgot password response | Always returns 200 — email existence not disclosed |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|--------|--------|
| Diagram generation (p95) | < 5 seconds |
| Page load (initial) | < 2 seconds |
| Auto-save | Non-blocking; fires 3s after scene change |
| Visual feedback loop | Runs in background; does not delay the primary response |

### 5.2 Security

| Control | Implementation |
|---------|---------------|
| HTTP security headers | `helmet` middleware |
| CORS | Whitelist-only via `CLIENT_URL` environment variable |
| Rate limiting — chat | 10 requests / minute / IP |
| Rate limiting — auth | 10 requests / 15 minutes / IP |
| Per-user token budget | Daily limit (default 100,000 Groq tokens/day) |
| Password hashing | bcrypt, 12 rounds |
| Input validation | Zod schemas on every route |
| NoSQL injection | `express-mongo-sanitize` strips `$` and `.` from bodies |
| Prompt injection | Detected and blocked (HTTP 400) on document ingest |
| Refresh token storage | httpOnly, Secure, SameSite cookie — not accessible to JavaScript |

### 5.3 Reliability

- Groq API calls wrapped in `withRetry()` — 3 attempts with exponential backoff on 429, 503, and timeout errors
- `withTimeout()` wraps all AI calls — 25 seconds for chat, 30 seconds for ingest
- Visual feedback loop fails safe — never blocks diagram delivery
- MCP server initialised once at startup; reconnects automatically

### 5.4 Scalability (current scope)

- Stateless Express server — horizontally scalable behind a load balancer
- MongoDB connection pooling via Mongoose
- Rate limiting at application layer (not infrastructure)
- Single-instance deployment on Render (free tier scope)

---

## 6. Out of Scope

The following were deliberately excluded from this build:

| Feature | Reason |
|---------|--------|
| Real-time collaboration | No multi-user simultaneous canvas editing |
| PDF / SVG export | PNG copy to clipboard is the only export format |
| Mobile app | Desktop browser only |
| Custom shape library | Uses Excalidraw's built-in shape set |
| Offline mode | Requires server connection for AI generation |
| Billing / usage tiers | No payment integration |
| Admin dashboard | Single-user system; no admin controls |

---

## 7. Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| AI plans; server positions | Prevents the LLM from hallucinating invalid pixel coordinates. The layout engine is deterministic and independently testable |
| 7 dedicated layout algorithms | One generic algorithm produces mediocre layouts for all diagram types. Purpose-built algorithms produce optimal results per class |
| Groq over OpenAI | Faster inference at comparable quality for structured tool-calling. Free tier; `llama-3.3-70b-versatile` handles the `plan_diagram` schema reliably |
| Canvas summarisation | Injecting a text summary of the current canvas (not raw JSON) keeps the AI context window small while preserving merge-mode awareness |
| Client-owned semantic state | Conversation semantic state (entities, layout conventions, open threads) is round-tripped on every request, persisted in MongoDB, and restored on load — no server-side session memory required |
| httpOnly refresh cookies | Prevents XSS-based token theft. Access tokens are short-lived; refresh tokens rotate on every use |
| MCP as canvas bridge | Decouples the AI service from Excalidraw internals. The MCP server owns the canvas update protocol |

---

## 8. Future Work

| Feature | Description |
|---------|-------------|
| Streaming diagram stages | Stream layout stages to the client for perceived performance improvement |
| Diagram-to-code export | Generate Terraform, Docker Compose, or SQL from architecture diagrams |
| Multi-page diagrams | Multiple canvas pages per drawing document |
| Collaborative editing | Real-time multi-user presence and simultaneous editing |
| Template library | Pre-built diagrams for common patterns (AWS architecture, ERD, org chart) |
| Mobile-responsive UI | Responsive layout for tablet and phone browsers |

---

*Document prepared as part of internship deliverables — June 2026.*
