# Codebase Overview

## Root

| File | What it does |
|------|--------------|
| `package.json` | Root workspace config — runs client + server concurrently |
| `render.yaml` | Render.com deployment config for server |
| `vercel.json` | Vercel deployment config (routes `/api/*` to Express, serves client) |
| `tsconfig.json` | Root TypeScript config (for the Next.js `src/` remnant) |
| `eslint.config.mjs` | ESLint config |
| `components.json` | shadcn/ui config (root-level, mirrors client) |
| `src/app/api/events/route.ts` | Next.js SSE endpoint — streams events to connected clients (leftover from an earlier Next.js prototype) |

---

## Server (`server/src/`)

### Entry & Config

| File | What it does |
|------|--------------|
| `index.ts` | Express app bootstrap — sets up CORS, rate limiting, mounts all routes, connects DB, inits MCP |

### Auth (`auth/`)

| File | What it does |
|------|--------------|
| `tokens.ts` | JWT signing/verification + refresh-token CRUD (create, rotate, delete via nanoid+bcrypt) |

### DB (`db/`)

| File | What it does |
|------|--------------|
| `connect.ts` | Singleton MongoDB connection via Mongoose |

### Middleware (`middleware/`)

| File | What it does |
|------|--------------|
| `auth.ts` | `requireAuth` Express middleware — extracts + verifies Bearer JWT, attaches `userId` to request |

### Models (`models/`)

| File | What it does |
|------|--------------|
| `User.ts` | Mongoose schema for users (email + hashed password) |
| `RefreshToken.ts` | Mongoose schema for refresh tokens with TTL index for auto-expiry |
| `Drawing.ts` | Mongoose schema for drawings — stores scene JSON, conversation history, tags, folder, share settings |
| `DrawingVersion.ts` | Mongoose schema for drawing snapshots — each save creates a numbered version (max 20) |
| `Folder.ts` | Mongoose schema for folders (name + color per user) |

### Routes (`routes/`)

| File | What it does |
|------|--------------|
| `auth.ts` | POST `/register`, `/login`, `/refresh`, `/logout`, GET `/me` — full email/password auth with rotating refresh tokens |
| `chat.ts` | POST `/chat` — validates body with Zod then calls `processMessage`, returns reply + updated scene |
| `drawings.ts` | CRUD for drawings (list/get/create/update/delete) + toggle share link |
| `versions.ts` | GET version list, GET single version, POST restore — drawing snapshot API |
| `folders.ts` | CRUD for folders, includes per-folder drawing counts via aggregation |
| `images.ts` | GET `/images?q=` — proxies Pexels image search |
| `share.ts` | GET `/share/:shareId` — public read-only drawing lookup (no auth) |
| `clear.ts` | POST `/clear` — returns an empty Excalidraw scene (canvas reset) |
| `health.ts` | GET `/health` — liveness ping returning `{ status: "ok" }` |

### Services (`services/`)

| File | What it does |
|------|--------------|
| `versions.ts` | `createVersion()` — increments version number, saves snapshot, prunes oldest if >20 |
| `images.ts` | `searchImages()` — fetches from Pexels API with 1h in-memory cache |

### MCP (`mcp/`)

| File | What it does |
|------|--------------|
| `client.ts` | Boots the Excalidraw MCP server as a child process via stdio, caches its tool list, exposes `callMcpTool` / `listMcpTools` |
| `resolvePath.ts` | Finds the compiled MCP entry point from `EXCALIDRAW_MCP_PATH` env or the vendored `dist/index.js` |

### AI (`ai/`)

| File | What it does |
|------|--------------|
| `groq.ts` | Core AI loop — sends messages to Groq LLM with tools, executes tool calls (`plan_diagram`, `fetch_images`, MCP tools), returns reply + updated scene |
| `scene.ts` | Normalises raw AI-generated elements into valid Excalidraw shapes (fills defaults, applies auto-grid layout, extracts checkpoint IDs) |
| `systemPrompt.ts` | The LLM system prompt defining the `plan_diagram` schema, rules, and examples |
| `canvas/summarize.ts` | Extracts a human-readable summary of the current canvas (nodes + edges) and formats it for injection into the next prompt |

### Layout Engine (`ai/layout/`)

| File | What it does |
|------|--------------|
| `types.ts` | TypeScript interfaces for `DiagramPlan`, `DiagramNode`, `DiagramEdge`, `ComputedLayout`, etc. |
| `index.ts` | Entry point — validates plan → runs algorithm → converts to Excalidraw elements; exports `LayoutError` |
| `validation.ts` | Sanitises the LLM plan: deduplicates IDs, fills missing labels, removes bad edges, caps at 40 nodes |
| `sizing.ts` | `computeNodeDimensions()` — calculates pixel width/height from size tier + label length |
| `themes.ts` | Three theme configs (`minimal`, `default`, `vibrant`) with colour palettes, stroke widths, and opacity |
| `utils.ts` | Shared helpers — `assignColors`, `buildEdges`, `buildGroups` used by all layout algorithms |
| `converter.ts` | `computedLayoutToExcalidraw()` — turns `ComputedLayout` into raw Excalidraw JSON objects (shapes, arrows, group containers) |
| `edge-router.ts` | `routeEdge()` — finds a non-overlapping arrow path between two nodes (straight → L-bend → U-bend → fallback) |
| `algorithms/flowchart.ts` | Grid layout (rows × columns) with support for merge-mode pinning of existing nodes |
| `algorithms/hierarchy.ts` | BFS tree layout — assigns levels from edges, centres each level horizontally |
| `algorithms/circular.ts` | Evenly spaces nodes around a circle scaled to their count and size |
| `algorithms/comparison.ts` | Two-column layout split by groups (or by halving the node list) |
| `algorithms/timeline.ts` | Horizontal row with nodes alternating above/below a central axis |
| `algorithms/mindmap.ts` | Central node (XL) with branches arranged radially at a computed radius |
| `algorithms/freeform.ts` | Simple 3-column grid; merge mode preserves existing node positions |

---

## Client (`client/src/`)

### Entry

| File | What it does |
|------|--------------|
| `main.tsx` | React root — wraps app in `BrowserRouter` + `AuthProvider`, renders `<App>` |
| `App.tsx` | Route table — `/login`, `/dashboard`, `/` (new canvas), `/drawing/:id`, `/share/:shareId`; wraps auth-required routes in `ProtectedRoute` |

### Pages (`pages/`)

| File | What it does |
|------|--------------|
| `AuthPage.tsx` | Sign-in / register form with tab toggle, inline validation, and password show/hide |
| `CanvasPage.tsx` | Main drawing screen — mounts Excalidraw, `ChatPanel`, `NodePanel`, `DrawingInfoBar`, `VersionHistoryPanel`; handles draft migration from localStorage |
| `DashboardPage.tsx` | Drawing library — sidebar folder nav, grid/list toggle, tag filter bar, search, per-card context menu with share/move/tag/delete |
| `SharePage.tsx` | Public read-only view of a shared drawing — loads scene by `shareId`, renders Excalidraw in view-only mode |

### Components (`components/`)

| File | What it does |
|------|--------------|
| `ChatPanel.tsx` | Right-side chat panel — message bubbles, text input, save/share/clear/version-history buttons, theme picker, example prompts |
| `DrawingInfoBar.tsx` | Floating pill at top centre of canvas showing current drawing title, folder, and tags |
| `NodePanel.tsx` | Context popup that appears when a canvas node is selected — offers "Explain" and "Go deeper" AI actions |
| `SaveDrawingDialog.tsx` | Modal for saving a drawing — title input, folder picker (with inline new-folder creation), tag editor |
| `VersionHistoryPanel.tsx` | Side panel listing drawing versions with restore button and element count |
| `ui/` | shadcn/ui primitives (badge, button, dialog, input, label, scroll-area, sheet, tabs, textarea, tooltip) |

### Hooks (`hooks/`)

| File | What it does |
|------|--------------|
| `useDrawingApp.ts` | Master canvas hook — owns scene state, chat messages, save/load/share/clear/version restore, auto-save debounce, node selection, and theme |
| `useDashboard.ts` | Dashboard data hook — fetches + filters drawings and folders, exposes CRUD actions with optimistic UI updates |

### Contexts (`contexts/`)

| File | What it does |
|------|--------------|
| `AuthContext.tsx` | React context + provider — restores session on mount via refresh token, exposes `login`, `register`, `logout`, `user`, `isAuthenticated` |

### Lib (`lib/`)

| File | What it does |
|------|--------------|
| `api.ts` | Axios instance with Bearer token injection, auto-refresh on 401, and typed wrappers for all API groups (auth, drawings, folders, versions, share, chat) |
| `scene.ts` | Client-side scene utilities — `sanitizeScene`, `sanitizeAppState` (strips runtime keys), `prepareElementsForCanvas` (converts AI skeletons to full Excalidraw elements) |
| `types.ts` | Shared TypeScript interfaces — `Message`, `User`, `DrawingMeta`, `DrawingFull`, `Folder`, `VersionMeta` |
| `relativeTime.ts` | `formatRelativeTime()` — converts a date to "X minutes/hours/days ago" |
| `utils.ts` | `cn()` (clsx + tailwind-merge), `detectDiagramType()`, `extractDiagramInfo()` |
