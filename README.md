# AI Drawing Engine

A conversational AI that draws on an Excalidraw canvas using Gemini and Excalidraw MCP.

## Setup

### 1. Get API Keys
- **GroqCloud**: Go to https://console.groq.com/keys → Get API Key → Free tier
- **Pexels**: Go to https://www.pexels.com/api → Get Free API Key

### 2. Configure Environment
```bash
cp server/.env.example server/.env
# Edit server/.env and add your keys
```

### 3. Install & Run
```bash
npm run install:all
npm run dev
```

Open http://localhost:5173

## Phase 2 Setup (MongoDB + Auth)

### 1. Create MongoDB Atlas cluster
- Go to https://cloud.mongodb.com
- Create a free M0 cluster
- Create a database user
- Whitelist 0.0.0.0/0 for dev access
- Copy the connection string

### 2. Generate JWT secrets
Run this twice to get two different secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Add V2 variables to server/.env
```
MONGODB_URI=<your connection string>
JWT_ACCESS_SECRET=<first generated secret>
JWT_REFRESH_SECRET=<second generated secret>
```

### 4. Run
```bash
npm run dev
```
Same as before — no new commands needed.

## New Features (P2)
- Create account and sign in with email + password
- Save drawings to your account
- Load and continue any saved drawing
- Share drawings via a public link
- Dashboard showing all your saved drawings

## Phase 3 Features

### AI Improvements
- Smarter auto-layout: the AI picks from 7 layout strategies (flowchart, hierarchy, cycle, etc.)
- Coordinate math: proper formulas for each layout type in the system prompt
- Mermaid fallback: complex diagrams rendered via @excalidraw/mermaid-to-excalidraw
- Post-processing: server-side layout normalization for misaligned elements
- Diagram type badge: chat shows what layout was used

### Organisation
- Folders: create color-coded folders, drag drawings between them
- Tags: add up to 10 tags per drawing, filter by tag in dashboard
- Search: client-side search across titles and tags
- List/grid view toggle in dashboard

### Version History
- Auto-snapshot on every save (last 20 versions kept per drawing)
- Version labels auto-generated from your last message
- Restore any version with one click
- Version history panel slides in from canvas side

## Architecture
- Frontend: React + Vite + Excalidraw + shadcn/ui
- Backend: Node.js + Express
- AI: llama-3.3-70b-versatile 
- Drawing: Excalidraw MCP (official MCP server)
- Images: Pexels API (free — 200 req/hour)

## Example Prompts
- "Show the lifecycle of water evaporation and condensation"
- "Draw how a TCP/IP handshake works"
- "Visualise merge sort step by step"
- "Map the layers of the Earth"
- "Show me the Krebs cycle"

## Deployment (Vercel + Render)

Recommended setup:
- Frontend (`client`) on Vercel
- Backend (`server`) on Render

### Backend on Render
Use **repo root** (recommended for npm workspaces):

| Setting | Value |
|--------|--------|
| Root Directory | *(leave empty)* |
| Build Command | `npm install && npm run build --workspace=server` |
| Start Command | `npm run start --workspace=server` |

Or use **server-only** root:

| Setting | Value |
|--------|--------|
| Root Directory | `server` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |

You can also deploy via the included `render.yaml` blueprint.

### MongoDB Atlas (required for Render)
Render uses dynamic IPs, so Atlas must allow external connections:

1. Open [MongoDB Atlas](https://cloud.mongodb.com) → your project → **Network Access**
2. Click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
3. Confirm (use restricted IPs only if you have a fixed egress IP)
4. In Render → **Environment**, set `MONGODB_URI` to your Atlas connection string  
   (format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`)
5. Redeploy the Render service

If the password contains special characters (`@`, `#`, etc.), URL-encode it in the connection string.
- Required env vars:
  - `MONGODB_URI`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `GROQ_API_KEY`
  - `PEXELS_API_KEY`
  - `NODE_ENV=production`
  - `CLIENT_URL=https://<your-vercel-domain>`
- You can allow multiple frontend domains by comma-separating `CLIENT_URL`:
  - `CLIENT_URL=https://app.vercel.app,https://app-git-feature.vercel.app`

### Frontend on Vercel
- Root directory: project root (or `client` if you prefer a separate project)
- Build command: `npm run build --workspace=client`
- Output directory: `client/dist`
- Env var:
  - `VITE_API_URL=https://<your-render-service>.onrender.com/api`

## Phase 5 — Core Quality Overhaul

No new features. The existing core loop brought up to a quality standard
where you would happily show the output to someone.

### What changed

**Edge routing** — arrows now route around obstacle nodes using a
border-attachment + obstacle-avoidance algorithm. Straight lines are
used where they are clear; L-bends and U-bends are chosen automatically
when the straight path would cross another node.

**Refinement reliability** — the server summarises the current canvas
before every AI call and injects a compact node/edge list as context.
The AI references existing node IDs for nodes it wants to keep, assigns
new IDs for nodes to add, and omits nodes or edges it wants to remove.
The layout engine pins existing nodes in place and only re-positions
new additions.

**Node interaction** — clicking any labelled shape on the canvas shows
a floating panel with two actions. "Explain" sends an explanation request
to the chat. "Go deeper" asks the AI to expand that node into its own
full diagram, creating a drill-down workflow.

**Loading narrative** — the loading bubble now shows what the AI is
doing step by step (planning → routing → placing) rather than a generic
spinner. Steps are replayed from the server response at 350 ms intervals.

**Visual themes** — three selectable themes via dots in the chat header.
Minimal: monochrome, thin strokes. Default: the existing V4 palette.
Vibrant: stronger fills and heavier strokes. Theme is stored in
localStorage and included in every request.

**Copy as PNG** — a one-click button exports the current canvas as a PNG
and writes it directly to the clipboard, ready to paste into a document
or message.

## Phase 6 — Production Hardening

### Error handling
Every request has a unique ID (X-Request-Id header) that appears in every
log line for that request. All console.log calls in the AI layer are
replaced with structured JSON logging compatible with log aggregators.
Groq calls retry up to 3 times with exponential backoff on rate limits and
transient failures. A 25-second timeout per Groq attempt and a 30-second
hard timeout on the full request prevent hanging connections. HTTP error
codes from the server map to specific user-facing messages in the client.
A React error boundary prevents canvas crashes from white-screening the app.

### Security
Per-user rate limiting (10 requests per minute by default, configurable
via USER_RATE_LIMIT_COUNT and USER_RATE_LIMIT_MS env vars) prevents any
single authenticated user from draining Groq quota. The chat endpoint zod
schema enforces a 2000-character message limit, strips null bytes, and caps
history depth. Share link responses use a field whitelist projection so
internal fields like userId and conversationHistory are never returned.

### Cost control
Token usage (input + output) is logged per request and accumulated per user
per day. Requests from users who exceed DAILY_TOKEN_LIMIT (default 100,000)
are rejected before calling Groq. Conversation history is trimmed to the
first message plus the last 6 exchanges before each request, reducing token
consumption on long sessions. The system prompt is passed as a static system
field (not a messages entry) so Groq can cache it across requests.

### New environment variables
  USER_RATE_LIMIT_COUNT=10      # max requests per user per window
  USER_RATE_LIMIT_MS=60000      # window duration in milliseconds
  DAILY_TOKEN_LIMIT=100000      # max tokens per user per day

## Phase 8 — Document to Diagram + Voice Input

### Document to diagram
Click the paperclip icon in the command bar to open the document panel.
Paste any text or upload a file (.md, .ts, .js, .py, .json, .yaml and more).
The AI analyses the content, detects its type (code, docs, API spec, notes),
picks an appropriate layout, and draws a diagram of its structure.
File size limit: 50KB. Content is truncated at 12,000 characters before
being sent to the AI.

Content type → layout mapping:
  Code files     → hierarchy (modules, classes, functions)
  README / docs  → mindmap (sections, features, concepts)
  API specs      → flowchart (endpoints, resources)
  JSON / YAML    → hierarchy (keys, nested structure)
  Meeting notes  → mindmap (topics, decisions, actions)
  Plain prose    → mindmap (extracted key concepts)

### Voice input
Click the microphone icon in the command bar (or it appears automatically
when your browser supports the Web Speech API). Speak your prompt — interim
transcript appears in real time in the input. The prompt auto-submits 600ms
after the final result is detected. Click the mic again or press Esc to cancel.
Supported in Chrome, Edge, and Safari. Not available in Firefox without flags.

## Phase 9 — Visual Feedback Loop

After every diagram is drawn, the AI reviews its own output:

  1. The client exports the rendered canvas as a compressed PNG
  2. The image is sent to /api/critique
  3. The server calls Groq llama-3.2-11b-vision-preview (free tier,
     same API key as the drawing AI — no new signup)
  4. The vision model looks for specific visual problems: text overflow,
     overlapping nodes, unreadable labels
  5. If issues are found, a targeted correction pass re-draws the diagram
     with adjusted node sizes and layout
  6. The corrected diagram replaces the original silently

The review runs in the background — the diagram appears immediately and
corrections are applied within a few seconds if needed. A small "✓ Auto-corrected"
toast appears briefly when a correction runs.

Auto-correct can be toggled off via the eye icon in the top-right canvas
controls. The preference is stored in localStorage.

### New environment variable
  CRITIQUE_RATE_LIMIT_COUNT=5   # max visual reviews per user per minute

### Why no new API key
Groq's llama-3.2-11b-vision-preview is multimodal and available on the
same free tier as the text models. The GROQ_API_KEY already configured
in server/.env covers both the drawing AI and the visual critique.

## Phase 9.0.1 — Intent Detection + Real Image Fix

### Intent detection
The AI now recognises five distinct drawing intents from how you phrase
your request and changes its output accordingly:

  "show me [X]"        → fetches a real photo from Pexels, annotates it
  "wireframe [X]"      → minimal theme, rectangles only, dashed edges
  "system design [X]"  → architecture layout, grouped by infrastructure layer
  "annotate [X]"       → adds labels to the existing canvas without redrawing
  "refine" / "clean up"→ improves sizing and layout of the existing canvas

A small pill appears in the command bar briefly when an intent is detected,
confirming the AI understood what kind of output you want.

### Real image fix
fetch_images now triggers reliably for any physical, biological, anatomical,
geographic, or real-world visual subject. The tool description and system
prompt rules were made more explicit — the AI calls fetch_images before
plan_diagram for real-world subjects rather than defaulting to boxes.

Requires PEXELS_API_KEY to be set in server/.env. Get a free key at
https://www.pexels.com/api (200 requests/hour on the free plan).
