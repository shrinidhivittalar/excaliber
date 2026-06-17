# Product Requirements Document
## Excaliber — AI-Powered Diagram Generation Engine

**Version:** 1.0  
**Author:** Shrinidhi  
**Date:** June 2026  
**Status:** Completed (Internship Build)

---

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
| AI Model | Groq API — `llama-3.3-70b-versatile` |
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

## 8. Out of Scope

The following were deliberately excluded from this build:

- **Real-time collaboration** — no multi-user simultaneous editing
- **PDF / SVG export** — PNG copy is the only export format
- **Mobile app** — desktop browser only
- **Custom shape library** — uses Excalidraw's built-in shape set
- **Offline mode** — requires server connection for AI generation
- **Billing / usage tiers** — no payment integration

---

## 9. Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| AI plans, server positions | Prevents the LLM from hallucinating invalid pixel coordinates. The layout engine is deterministic and testable. |
| 7 distinct layout algorithms | One generic algorithm produces mediocre layouts for all types. Dedicated algorithms produce optimal results per diagram class. |
| MCP as canvas bridge | Decouples the AI service from Excalidraw internals. The MCP server owns the canvas protocol; the AI service owns logic. |
| Groq over OpenAI | Significantly faster inference at comparable quality for structured tool-calling tasks. `llama-3.3-70b-versatile` handles the `plan_diagram` schema reliably. |
| Canvas summarisation | Injecting a text summary of the current canvas (not the raw JSON) into each prompt keeps the AI context window small while preserving contextual awareness for merge operations. |
| HTTP-only refresh cookies | Prevents XSS-based token theft. Access tokens are short-lived; refresh tokens rotate on use. |

---

## 10. Future Work

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
