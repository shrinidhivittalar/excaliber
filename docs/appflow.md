# Excaliber — Application Flow Documentation

**Version**: 1.0  
**Last Updated**: June 2026

---

## 1. Overview

This document describes every user journey, screen-by-screen flow, and system-level transition in Excaliber. The application has a single user role (authenticated user) with all drawing, AI, and management capabilities.

---

## 2. High-Level Navigation Map

```
                        ┌────────────────────────┐
                        │      Login Page         │
                        │   /login                │
                        └──────────┬─────────────┘
                                   │
                     ┌─────────────┴────────────┐
                     │                          │
              ┌──────▼──────┐           ┌───────▼───────┐
              │  Register    │           │  Forgot        │
              │  /register   │           │  Password      │
              └──────┬──────┘           │  /forgot-pwd   │
                     │                  └───────┬───────┘
                     │                          │
                     │                   ┌──────▼────────┐
                     │                   │ Reset Password │
                     │                   │ /reset-pwd     │
                     │                   └───────────────┘
                     │
              ┌──────▼──────────────────────────────┐
              │           Dashboard                  │
              │           /dashboard                 │
              │                                      │
              │  All Drawings  |  Folders  |  Search  │
              └──────────────────────┬──────────────┘
                                     │
                            ┌────────▼──────────┐
                            │   Canvas Page      │
                            │   /canvas/:id      │
                            │                    │
                            │  CommandBar        │
                            │  Excalidraw Canvas │
                            │  Canvas Toolbar    │
                            │  Version History   │
                            │  Node Panel        │
                            └────────────────────┘
                                     │
                            ┌────────▼──────────┐
                            │   Share Page       │
                            │   /share/:shareId  │
                            │  (public, no auth) │
                            └────────────────────┘
```

---

## 3. Authentication Flows

### 3.1 Registration

```
[Login Page]
    │
    [Create account] link clicked
    │
    ▼
[Register Page] — /register
    │  Inputs: Email, Password (min 8 chars)
    │
    ├─ [Client validation fails] ──► Inline field errors shown, cannot submit
    │
    ├─ [Submit]
    │        │
    │        ├─ [Email already registered] ──► Toast: "Email already registered."
    │        │
    │        └─ [Success] ──► Access token stored in memory
    │                         refreshToken set as httpOnly cookie (7 days)
    │                         Redirect → /dashboard
    │
    └─ [Already have an account?] ──► /login
```

### 3.2 Login

```
[Login Page] — /login
    │  Inputs: Email, Password
    │
    ├─ [Client validation fails] ──► Inline field errors
    │
    ├─ [Submit]
    │        │
    │        ├─ [Invalid credentials] ──► Toast: "Invalid email or password."
    │        │
    │        └─ [Success] ──► Access token stored in memory
    │                         Redirect → /dashboard
    │
    └─ [Forgot password?] ──► /forgot-password
```

### 3.3 Password Reset

```
[Forgot Password Page] — /forgot-password
    │  Input: Email
    │
    ▼
[Submit]
    │
    └─ [Always returns success message]
       "If that email exists, a reset link has been sent."
       (email existence is not disclosed)
            │
            ▼
       [User receives email with reset link]
       Link format: /reset-password?token=<rawToken>
       Expires: 1 hour
            │
            ▼
[Reset Password Page] — /reset-password?token=<rawToken>
    │  Inputs: New password, Confirm password (client-side match check)
    │
    ├─ [Token expired or invalid] ──► Error: "This reset link has expired. Please request a new one."
    │
    └─ [Success] ──► Toast: "Password updated successfully."
                     Redirect → /login
```

### 3.4 Session Management

```
[Any Authenticated Request]
    │
    ├─ [Access token valid (15 min TTL)] ──► Request proceeds
    │
    └─ [Access token expired]
              │
              ▼
         [Silent token refresh]
         POST /api/auth/refresh
         Reads httpOnly refreshToken cookie
              │
              ├─ [Refresh token valid] ──► New access token issued
              │                            Refresh token rotated (old deleted)
              │                            Original request retried
              │
              └─ [Refresh token expired or invalid]
                        │
                        ▼
                   [Logout] ──► Redirect → /login
                   Toast: "Session expired. Please log in again."
```

---

## 4. Dashboard Flows

### 4.1 Dashboard Layout

```
[Dashboard] — /dashboard
    │
    ├── [Header]
    │     Logo | Search bar | [New Drawing] button | User avatar + logout
    │
    ├── [Sidebar]
    │     [All Drawings] (default)
    │     [Folders]
    │       └── Folder list with colour indicators and drawing counts
    │     [+ New Folder]
    │
    └── [Main Content Area]
          Filter bar: All | Recent | Starred
          Sort: Last modified ▼
          Drawing cards grid
          Empty state: "No drawings yet. Start by creating a new one."
```

### 4.2 Create Drawing

```
[Dashboard]
    │
    [New Drawing] clicked
    │
    ▼
[New drawing created (unsaved draft)]
Redirect → /canvas (no :id yet — unsaved)

Canvas opens with:
  - Empty Excalidraw canvas
  - CommandBar at the bottom
  - Prompt chips: "Draw a TCP handshake", "Mindmap the React lifecycle"...
```

### 4.3 Open Existing Drawing

```
[Dashboard]
    │
    [Drawing card] clicked
    │
    ▼
[Canvas Page] — /canvas/:id
    │
    GET /api/drawings/:id
    │
    ├─ [Drawing exists, user owns it]
    │       └─ Scene JSON applied to canvas
    │          Conversation history restored
    │          Semantic state restored
    │          Version list loaded
    │
    └─ [Not found or unauthorised] ──► Redirect → /dashboard
                                        Toast: "Drawing not found."
```

### 4.4 Folder Management

```
[Sidebar] → [+ New Folder]
    │
    ▼
[Inline input: Folder name]
    │
    [Create]
    │
    POST /api/folders { name, color }
    │
    └─ [Success] ──► Folder appears in sidebar

[Folder] → [⋮ menu]
    ├── [Rename] ──► Inline edit ──► PATCH /api/folders/:id
    ├── [Change colour] ──► Colour picker ──► PATCH /api/folders/:id
    └── [Delete] ──► Confirm modal ──► DELETE /api/folders/:id
                     All drawings in folder move to "All Drawings"
```

---

## 5. Canvas Flows

### 5.1 Canvas Layout

```
[Canvas Page]
    │
    ├── [Canvas Topbar] (auto-hides on idle, revealed on hover)
    │     Drawing title (editable) | Folder | Tags | [Save] | [Share] | [Copy PNG] | [Undo] | [Versions]
    │
    ├── [Excalidraw Canvas] (centre, full screen)
    │     Interactive: zoom, pan, select, annotate manually
    │     AI elements placed here automatically
    │
    ├── [CommandBar] (bottom, pill-shaped)
    │     Text input | Voice mic | File paperclip | Theme selector | Prompt chips
    │
    └── [Node Panel] (right side, appears on element click)
          Selected node name
          [Explain this] | [Drill down] | [Related concepts]
```

### 5.2 AI Chat Flow (Main)

```
[CommandBar]
    │
    User types message and presses Enter (or submits via voice)
    │
    ▼
[Client-side: detectIntent(message)]
    │
    ├─ Intent detected (wireframe, show_me, system_design, annotate, refine)
    │       └─ Intent pill shown above CommandBar for 3s
    │          effectiveTheme overridden for this request only (if wireframe)
    │
    ▼
[POST /api/chat]
    { message, history (first + last 6), sceneJson, theme, semanticState }
    │
    [Loading state]
    Stages cycle through: "Thinking..." → "Asking AI..." → "Planning diagram..." → "Placing on canvas..."
    │
    ▼
[Server: processMessage()]
    │
    ├── summarizeScene() — reads current canvas, injects as [CURRENT CANVAS] context
    ├── trimHistory() — keeps first message + last 6 exchanges
    ├── runToolLoop() — calls Groq, executes tool calls until done
    │       │
    │       ├── plan_diagram tool call
    │       │       └── planToExcalidrawElements() → Excalidraw JSON
    │       │           callMcpTool('create_view') → updates canvas
    │       │
    │       └── fetch_images tool call (if show_me intent)
    │               └── searchImages() → Pexels API
    │                   Returns image URL embedded in diagram
    │
    └── Returns: { reply, sceneJson, toolsUsed[], stages[], lastPlan? }
    │
    ▼
[Client receives response]
    │
    ├── applySceneToCanvas() — pushes new elements into Excalidraw
    ├── prevSceneRef updated (enables undo)
    ├── Assistant message added to chat history
    ├── autoSaveDrawing() triggered (if drawing has an ID)
    │
    └── [If lastPlan present] → runVisualFeedback() in background
              │
              └── See: Visual Feedback Loop (Section 5.4)
```

### 5.3 Document Ingest Flow

```
[CommandBar] → [Paperclip] button clicked
    │
    ▼
[Ingest Panel opens]
    │
    ├── [Drag and drop file]
    │       OR
    └── [Paste text]

[File detected]
    │
    ├─ [> 50 KB] ──► Toast: "File too large. Keep it under 50 KB."
    │
    └─ [Accepted]
          FileReader reads content (truncated to 12,000 chars)
          Content type detected from extension:
            .ts/.tsx/.js/.jsx/.py/.go → code → suggests hierarchy
            .md/.mdx → markdown → suggests mindmap
            .json/.yaml/.yml → data → suggests hierarchy
            .csv → csv → suggests comparison
          Type badge and layout suggestion shown in panel
              │
              ▼
          [Submit]
              │
              POST /api/ingest { content, filename, semanticState }
              │
              [Same stage animation as chat]
              │
              └─ [Response] ──► applySceneToCanvas()
                                 Analysis comment added to chat
```

### 5.4 Visual Feedback Loop

```
[After every diagram is rendered]
    │
    Wait 500ms (let Excalidraw finish rendering)
    │
    ▼
[exportToBlob()] — export canvas as PNG
    │
    ▼
POST /api/critique { image: base64PNG, lastPlan }
    │
    [Server: critiqueImage() via llama-4-scout-17b]
    Checks for: text overflow, overlapping nodes, unreadable labels, disconnected edges
    Returns: { hasIssues: boolean, issues: string[] }
    │
    ├─ [No issues] ──► Done, no change to canvas
    │
    └─ [Issues found]
              │
              runCorrectionPass(issues, originalPlan, currentSceneJson)
              │
              ├─ [Correction succeeds] ──► applySceneToCanvas(correctedScene)
              │                            Toast: "✓ Auto-corrected" for 4s
              │
              └─ [Correction fails] ──► Original canvas preserved
                                         (feedback loop always fails safe)
```

### 5.5 Voice Input Flow

```
[CommandBar] → [Mic] button clicked
    │
    ▼
[SpeechRecognition.start()]
continuous: true | interimResults: true
    │
    ├── [Interim results] ──► Transcript displayed in CommandBar in real time
    │                          Waveform animation shown
    │
    ├── [Final result (isFinal: true)]
    │         600ms timer starts
    │         └─ [600ms elapsed] ──► Auto-submit to chat
    │
    └── [Esc pressed or mic clicked again]
              SpeechRecognition.stop()
              Transcript cleared
              Timer cancelled
```

### 5.6 Node Interaction Flow

```
[User clicks a labelled shape on the Excalidraw canvas]
    │
    ▼
[handleSceneChange detects selection]
selectedNode state set → Node Panel slides in from right
    │
[Node Panel]
    ├── [Explain this] ──► Pre-fills CommandBar: "Explain [NodeName]"
    │                       Auto-submits to chat
    │
    ├── [Drill down] ──── Pre-fills: "Drill down into [NodeName]"
    │                      Auto-submits (merge mode)
    │
    └── [Related concepts] ── Pre-fills: "What concepts relate to [NodeName]?"
                                Auto-submits to chat
```

---

## 6. Version History Flow

```
[Canvas Topbar] → [Versions] button
    │
    ▼
[Version History Panel slides in]
    │
    GET /api/drawings/:id/versions
    │
    Version list (newest first):
    │   v5  "Added Redis layer"         2026-06-20 14:32
    │   v4  "Auto-save"                 2026-06-20 14:28
    │   v3  "Refine layout"             2026-06-20 14:15
    │   ...
    │
    [Version row] → [Restore]
          │
          ▼
     [Confirm modal]
     "Restore to v3? Current canvas will be replaced."
     [Restore] | [Cancel]
          │
          POST /api/drawings/:id/versions/:versionId/restore
          │
          └─ Scene and conversation history replaced
             Toast: "Restored to v3" for 3s
             Version panel closes
```

---

## 7. Share Flow

```
[Canvas Topbar] → [Share] button
    │
    ├─ [Drawing unsaved] ──► Auto-save triggered first
    │
    ▼
POST /api/drawings/:id/share
    │
    ├─ [Share link generated] ──► URL copied to clipboard
    │                              Toast: "Link copied to clipboard"
    │                              Share URL format: {origin}/share/{shareId}
    │
    └─ [Share already active] ──► Existing link copied to clipboard

[Public viewer navigates to /share/:shareId]
    │
    GET /api/share/:shareId  (no auth required)
    │
    └─ [Read-only canvas view]
       Drawing title shown
       Canvas displayed (pan and zoom, no edit)
       No CommandBar, no toolbar
```

---

## 8. Error and Fallback States

### 8.1 API Error Handling

| HTTP Status | User-Facing Message | Behaviour |
|-------------|---------------------|-----------|
| 400 | Field-specific validation message | Inline error or toast |
| 401 | "Session expired. Please log in." | Silent token refresh attempted; redirect to login if refresh fails |
| 403 | "You don't have permission to do this." | Toast shown, user stays on page |
| 404 | "Not found." | Redirect to dashboard with toast |
| 429 | "Too many requests. Please wait a moment." | Toast shown; retry after shown if available |
| 503 | "Service is busy. Please try again shortly." | Toast with retry option |
| Network error | "You appear to be offline. Check your connection." | Toast shown |

### 8.2 Canvas-Specific Errors

| Scenario | Behaviour |
|----------|-----------|
| AI returns invalid diagram plan | `validateAndFixPlan()` auto-corrects common issues (missing IDs, duplicate edges). If unfixable, error toast shown and canvas unchanged |
| Groq timeout (> 25s) | `withTimeout()` throws; toast: "Request timed out. Try a simpler prompt." |
| Mermaid fallback | If AI returns a markdown code block instead of a tool call, parsed via `@excalidraw/mermaid-to-excalidraw` |
| Canvas > 200 elements | Warning toast: "Canvas is getting full — consider starting a new drawing." |

### 8.3 Empty States

| Screen | Message | Action |
|--------|---------|--------|
| Dashboard — no drawings | "No drawings yet. Create your first one." | [New Drawing] button |
| Dashboard — folder empty | "This folder is empty." | [New Drawing] |
| Dashboard — search no results | "No drawings match '[query]'." | [Clear search] |
| Version history — none | "No versions saved yet." | — |

---

## 9. Screen Inventory

| Screen | Route | Auth Required |
|--------|-------|--------------|
| Login | `/login` | No |
| Register | `/register` | No |
| Forgot Password | `/forgot-password` | No |
| Reset Password | `/reset-password` | No |
| Dashboard | `/dashboard` | Yes |
| Canvas (new) | `/canvas` | Yes |
| Canvas (existing) | `/canvas/:id` | Yes |
| Public Share View | `/share/:shareId` | No |
| 404 | `*` | No |
