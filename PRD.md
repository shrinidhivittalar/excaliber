# Product Requirements Document
## Excaliber — AI-Powered Diagram Generation Engine


## 1. Executive Summary

Excaliber is a full-stack AI-powered diagramming tool that converts natural language into structured visual diagrams on an interactive canvas. Users describe what they want to visualise — a system architecture, a biological concept, a code structure, a process flow — and the AI produces a complete, properly laid-out diagram in seconds.

Unlike traditional diagramming tools where users manually place and connect shapes, Excaliber handles all positioning, sizing, and routing automatically. The user's only job is to describe the idea.

---

## 2. Problem Statement

Existing diagramming tools (Lucidchart, draw.io, Miro) require users to:

- Manually drag, place, and connect every shape
- Spend significant time on layout rather than content
- Have design intuition to make diagrams look good
- Rebuild diagrams from scratch when concepts change

This creates friction, especially for developers, students, and researchers who need to quickly visualise technical concepts but don't want to spend time on visual formatting.

**Excaliber eliminates this friction.** You describe the concept; the engine draws it.

---

## 3. Target Users

| User Type | Use Case |
|-----------|----------|
| Software Engineers | System architecture diagrams, API flow charts, code structure maps |
| Students | Concept maps, biology diagrams, history timelines, process flows |
| Technical Architects | Infrastructure diagrams, microservice layouts, decision trees |
| Product Teams | Wireframes, user flows, feature comparison charts |
| Researchers | Document structure visualisation, meeting note maps, relationship diagrams |

---

## 4. Core Features

### 4.1 Natural Language Diagram Generation
Users type a prompt in plain English. The AI interprets the intent, selects the appropriate layout, defines nodes and edges, and renders the diagram on the canvas automatically.

- Understands intent: `"show me how TCP handshake works"` → flowchart
- Handles refinement: `"add Redis between the API and DB"` → merges into existing canvas
- Supports intents: `SHOW_ME`, `WIREFRAME`, `SYSTEM_DESIGN`, `ANNOTATE`, `REFINE`
- Prompt chips surface example prompts to guide new users

### 4.2 Layout Engine (7 Algorithms)
A custom server-side layout engine computes all element positions. The AI never produces coordinates — it describes the diagram semantically and the engine handles geometry.

| Layout | Best For |
|--------|----------|
| `flowchart` | Step-by-step processes, pipelines, request flows |
| `hierarchy` | Trees, org charts, parent-child structures, code imports |
| `circular` | Life cycles, ring structures, recurring processes |
| `comparison` | Versus tables, pros/cons, side-by-side analysis |
| `timeline` | Events over time, roadmaps, historical sequences |
| `mindmap` | Concepts radiating from a central idea, brainstorming |
| `freeform` | Annotated images, anatomy diagrams, anything else |

**Edge routing** is handled automatically — arrows avoid node collisions and follow clean paths.

### 4.3 Document Ingestion
Users paste or drop any text-based file. The system auto-detects content type and generates an appropriate diagram from its structure.

| Input Type | Detected Layout |
|------------|----------------|
| `.ts`, `.js`, `.py`, `.go` (code files) | Hierarchy (modules, classes, imports) |
| `.md` / README | Mindmap (sections, features, topics) |
| JSON / YAML config | Hierarchy (keys, nested values, 3 levels deep) |
| API spec / routes file | Flowchart (endpoints grouped by method) |
| Database schema / models | Comparison (tables, foreign key relationships) |
| Meeting notes / bullet lists | Mindmap (agenda, decisions, action items) |
| Plain prose / articles | Mindmap (6–12 key extracted concepts) |

Accepts: drag-and-drop files, pasted text. Processes up to 10,000 characters.

### 4.4 Real-World Image Integration
For physical or biological subjects (`"show me a human heart"`, `"map the solar system"`), the system fetches reference images from Pexels before generating the diagram. The image is embedded in the canvas as a central reference node, surrounded by annotation nodes pointing to key features.

### 4.5 Diagram Themes
Three visual themes apply across all layouts:

| Theme | Character |
|-------|-----------|
| `minimal` | Transparent fills, light strokes, wireframe aesthetic |
| `default` | Soft pastel palette (blue, green, yellow, pink, purple) |
| `vibrant` | Saturated palette, bold strokes, high contrast |

### 4.6 Canvas Operations
- **Undo** — revert the last AI-generated diagram change
- **Merge mode** — add nodes to an existing canvas without redrawing it
- **Auto-correct** — a second AI pass that detects and fixes text overflow and overlapping nodes
- **Canvas summarisation** — the current canvas state is described and injected into each AI request for contextual awareness
- **Copy as PNG** — exports the current canvas to clipboard

### 4.7 Drawing Management
- **Save drawings** with a title, up to 10 tags, and folder assignment
- **Version history** — automatic snapshots on each save, with restore
- **Folders** — organise drawings into named collections
- **Sharing** — generate a public share link for any drawing (read-only)
- **Thumbnail** — stored per drawing for dashboard preview

### 4.8 Diagram Critique
A dedicated critique route provides AI feedback on the current canvas — identifies structural issues, readability problems, and layout improvements.

### 4.9 Authentication
- Email/password registration and login
- JWT access tokens (short-lived) + refresh tokens (HTTP-only cookie)
- Protected routes across the full API

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| Canvas | Excalidraw (via MCP server) |
| Backend | Express.js + TypeScript |
| Database | MongoDB + Mongoose |
| AI Model | Groq API — `llama-4-maverick-17b-128e-instruct` |
| Image Search | Pexels API |
| Auth | JWT + bcrypt + HTTP-only refresh cookies |

### 5.2 System Architecture

```
User
 │
 ▼
React Client (Vite)
 │   CommandBar  →  AI prompt / file ingest
 │   CanvasPage  →  Excalidraw canvas
 │   ChatPanel   →  conversation history
 │
 ▼ REST API (Express)
 │
 ├─ /api/chat       →  processMessage()
 │     │
 │     ├─ Groq LLM  →  plan_diagram tool call
 │     │               (layout + nodes + edges)
 │     │
 │     └─ Layout Engine
 │           ├─ Validation
 │           ├─ Algorithm (one of 7)
 │           ├─ Edge Router
 │           └─ Excalidraw Converter
 │                     │
 │                     └─ MCP → Excalidraw canvas
 │
 ├─ /api/ingest     →  processIngest() (document → diagram)
 ├─ /api/images     →  Pexels image search
 ├─ /api/critique   →  AI canvas review
 ├─ /api/auth       →  register / login / refresh / logout
 ├─ /api/drawings   →  CRUD + version history
 ├─ /api/folders    →  folder management
 └─ /api/share      →  public share links
        │
        ▼
      MongoDB
       ├─ User
       ├─ Drawing (sceneJson + conversationHistory + tags + thumbnail)
       ├─ DrawingVersion (snapshot per save)
       ├─ Folder
       └─ RefreshToken
```

### 5.3 AI Tool Protocol
The AI operates as a **planner, not a renderer**. It calls structured tools; the server handles all geometry.

| Tool | Purpose |
|------|---------|
| `plan_diagram` | Describe nodes, edges, groups, layout type — server positions everything |
| `fetch_images` | Search Pexels for real-world reference images before drawing |
| `create_view` | Low-level MCP call to update the Excalidraw canvas |
| `read_me` | Read canvas state (called once per conversation) |

### 5.4 Layout Engine Pipeline

```
DiagramPlan (from AI)
       │
       ▼
  1. Validation     — fix missing fields, clamp sizes, deduplicate ids
       │
       ▼
  2. Layout Algorithm — compute x/y/width/height for every node
       │
       ▼
  3. Edge Router    — route arrows between computed positions
       │
       ▼
  4. Converter      — emit Excalidraw element JSON
       │
       ▼
  Excalidraw Canvas
```

### 5.5 Infrastructure
- **Rate limiting:** 10 chat requests / minute / IP
- **Per-user token budget tracking** — monitors Groq API usage per user
- **Request IDs** — every request tagged for log correlation
- **Retry logic** — exponential backoff on transient Groq errors (429, 503, timeout)
- **Structured logging** — JSON logs with request ID, user ID, stage, token counts

---

## 6. UI Design System

| Element | Specification |
|---------|--------------|
| Accent color | Indigo (`#6366f1`) |
| Canvas topbar | Auto-hides on idle, reveals on hover/focus |
| Backgrounds | Frosted glass panels (`backdrop-blur`) |
| Dashboard | Dot-grid pattern, spotlight hover cards |
| CommandBar | Centered input, prompt chip suggestions, drag-and-drop file detection |
| Loading states | Cycling stage labels (`Thinking...` → `Asking AI...` → `Placing on canvas...`) |

---

## 7. Development Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| P1–P3 | Canvas foundation, Excalidraw integration, basic AI chat, JWT auth | Done |
| P4 | Layout Engine v1 — all 7 algorithms, edge routing, 3 themes, server-side positioning | Done |
| P5 | Document ingestion — auto-detect 8 content types, generate diagrams from files | Done |
| P6 | Voice input — speech-to-text prompt entry | Done |
| P7 | UI overhaul — design system, frosted glass, dot-grid dashboard, spotlight cards | Done |
| P8 | Drawing management — save, folders, version history, sharing, tags, thumbnails | Done |
| P9 | Canvas polish — CommandBar unification, auto-hide topbar, diagram critique, auto-correct | Done |

---

## 8. Non-Functional Requirements

### 8.1 Performance
| Metric | Target |
|--------|--------|
| AI diagram generation (P95) | < 8 seconds end-to-end |
| Canvas render after layout | < 300 ms |
| Document ingest processing | < 5 seconds for 10,000 characters |
| Dashboard load (drawing list) | < 1.5 seconds |
| Auth endpoints (login/register) | < 500 ms |

### 8.2 Reliability & Availability
- **Groq API failures:** Exponential backoff with 3 retries on 429/503/timeout. On final failure, return a user-visible error message; do not silently drop the request.
- **Pexels API failures:** If image fetch fails, the diagram proceeds without the image node — generation is not blocked.
- **MCP canvas bridge failure:** If the Excalidraw MCP call fails, the server logs the error and returns the raw element JSON to the client for local application.
- **Database write failure on save:** Return a 500 with a clear message; do not silently lose data.
- **Rate limit hit (10 req/min/IP):** Return HTTP 429 with a `Retry-After` header and a human-readable message.

### 8.3 Security
| Requirement | Implementation |
|-------------|---------------|
| Authentication on all data routes | JWT middleware — 401 on missing/expired token |
| Token storage | Access token: memory only; refresh token: HTTP-only cookie |
| Refresh token rotation | Each refresh issues a new token; old token is invalidated |
| Input sanitisation | All `req.body` and `req.params` values sanitised before DB writes or AI injection |
| Rate limiting | 10 chat requests / minute / IP to prevent AI cost abuse |
| Password storage | bcrypt with cost factor 12 |
| Share links | Read-only; no auth required; drawing owner can revoke |

### 8.4 Storage & Data Limits
| Entity | Limit |
|--------|-------|
| Drawings per user | Unlimited |
| Tags per drawing | 10 |
| Versions per drawing | Unlimited (snapshot per save) |
| Document ingest input | 10,000 characters max |
| Thumbnail size | JPEG, max 50 KB |
| Conversation history per drawing | Trimmed to last 20 turns before AI injection |

### 8.5 AI Model Constraints
- Model: `llama-4-maverick-17b-128e-instruct` via Groq
- Token budget tracked per user per session; warnings surfaced in logs
- System prompt is the single source of truth for tool schema — model is never given coordinates directly
- If the model returns a malformed `plan_diagram` call, the layout engine validation layer repairs or rejects it before rendering

---

## 9. Error Handling & Edge Cases

### 9.1 Input Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Empty prompt submitted | Frontend blocks submission; button disabled until ≥ 3 characters |
| Prompt exceeds context window | Server truncates conversation history to last 20 turns, preserving the system prompt |
| Unsupported file type dropped on CommandBar | Toast error: "Unsupported file type. Try .ts, .js, .py, .go, .md, .json, .yaml." |
| File larger than 10,000 characters | Server truncates to 10,000 chars and continues; user sees a warning in the chat response |
| Non-text file (image, binary) pasted | Detected by MIME type check; rejected with message before AI call |
| Prompt in a non-English language | Passed to AI as-is; Groq handles multilingual input; diagram labels may be in that language |

### 9.2 AI & Generation Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| AI returns no tool call | Server responds with the AI's raw text as a chat message; canvas is unchanged |
| AI returns invalid node schema | Layout engine validator fills in defaults (missing `label` → `"Node"`, missing `type` → `"rectangle"`) |
| Layout engine produces overlapping nodes | Auto-correct pass runs a second AI call to detect and reposition affected nodes |
| Zero nodes returned | Canvas is unchanged; user sees: "I couldn't generate a diagram for that. Try rephrasing." |
| Circular dependency in hierarchy layout | Detected at validation; layout falls back to `freeform` and logs a warning |
| Image fetch returns no results (Pexels) | Diagram proceeds without image node; user sees a note in the chat response |
| Groq rate limit (429) | Retry with exponential backoff (1s, 2s, 4s); if all retries fail, return HTTP 503 with message |

### 9.3 Authentication Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Expired access token on request | Server returns 401; client auto-calls `/api/auth/refresh` using the HTTP-only cookie |
| Refresh token expired or revoked | Client receives 401 on refresh; redirected to login page; local state cleared |
| Duplicate email on registration | Returns 409 Conflict with message "Email already in use" |
| Wrong password on login | Returns 401 with message "Invalid credentials" (no indication of which field is wrong) |
| Concurrent refresh calls (race condition) | First refresh wins; second receives 401 (token already rotated); client retries from login |

### 9.4 Drawing Management Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Save with no title | Defaults to `"Untitled Drawing"` |
| Restore a version over an unsaved canvas | Confirmation modal: "Restore this version? Unsaved changes will be lost." |
| Delete a folder containing drawings | Drawings are unfoldered (orphaned), not deleted |
| Share link accessed by logged-in user | Renders read-only view regardless of ownership |
| Share link accessed with drawing deleted | Returns 404 with message "This drawing is no longer available" |
| Thumbnail generation failure | Drawing saves successfully; thumbnail field is null; dashboard shows placeholder |

---

## 10. Out of Scope

The following were deliberately excluded from this build:

- **Real-time collaboration** — no multi-user simultaneous editing
- **PDF / SVG export** — PNG copy is the only export format
- **Mobile app** — desktop browser only
- **Custom shape library** — uses Excalidraw's built-in shape set
- **Offline mode** — requires server connection for AI generation
- **Billing / usage tiers** — no payment integration

---

## 11. Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| AI plans, server positions | Prevents the LLM from hallucinating invalid pixel coordinates. The layout engine is deterministic and testable. |
| 7 distinct layout algorithms | One generic algorithm produces mediocre layouts for all types. Dedicated algorithms produce optimal results per diagram class. |
| MCP as canvas bridge | Decouples the AI service from Excalidraw internals. The MCP server owns the canvas protocol; the AI service owns logic. |
| Groq over OpenAI | Significantly faster inference at comparable quality for structured tool-calling tasks. `llama-4-maverick-17b-128e-instruct` handles the `plan_diagram` schema reliably. |
| Canvas summarisation | Injecting a text summary of the current canvas (not the raw JSON) into each prompt keeps the AI context window small while preserving contextual awareness for merge operations. |
| HTTP-only refresh cookies | Prevents XSS-based token theft. Access tokens are short-lived; refresh tokens rotate on use. |

---

## 12. Future Work

| Feature | Description |
|---------|-------------|
| Streaming responses | Stream layout stages to the client for perceived performance improvement |
| Diagram-to-code export | Generate code from system design diagrams (e.g., Terraform, Docker Compose) |
| Multi-page diagrams | Support multiple canvas pages per drawing |
| Collaborative cursors | Real-time multi-user presence on shared drawings |
| Template library | Pre-built diagrams for common use cases (AWS architecture, org chart, ERD) |
| Improved image integration | Use fetched images as actual background references within nodes, not just URLs |

---

*Document prepared as part of internship deliverables — June 2026.*
