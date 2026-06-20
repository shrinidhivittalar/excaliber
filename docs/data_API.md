# Excaliber — Data & API Documentation

**Version**: 1.0  
**Base URL**: `https://your-backend.onrender.com`  
**Auth**: `Authorization: Bearer <access_token>`  
**Content-Type**: `application/json`  
**Last Updated**: June 2026

---

## 1. API Conventions

### 1.1 Request Format

```
Authorization: Bearer <access_token>
Content-Type: application/json
X-Request-ID: <uuid>          (set automatically by server for each request)
```

### 1.2 Response Format

All endpoints return JSON. There is no envelope wrapper — data is returned directly.

**Success (2xx):**
```json
{ "user": { "id": "...", "email": "..." }, "accessToken": "..." }
```

**Error (4xx / 5xx):**
```json
{ "error": "Descriptive error message" }
```

### 1.3 Pagination

List endpoints that return arrays do not currently paginate — all records for the authenticated user are returned. This is suitable for the current single-user-per-account scope.

### 1.4 Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `POST /api/chat` | 10 requests | 1 minute |
| `POST /api/ingest` | Per-user budget | Rolling |
| `POST /api/critique` | Per-user budget | Rolling |
| All `/api/auth/*` routes | 10 requests | 15 minutes |
| All other authenticated routes | Per-user budget | Rolling |

When rate limited: `429 Too Many Requests`
```json
{ "error": "Too many attempts, please try again later." }
```

---

## 2. Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Validation:**
- `email`: must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `password`: must be at least 8 characters

**Response 201:**
```json
{
  "user": {
    "id": "6654f1b2e3a1b4c5d6e7f8a9",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
Sets `refreshToken` httpOnly cookie (7 days).

**Errors:**
| Status | Message |
|--------|---------|
| 400 | "Invalid email format" |
| 400 | "Password must be at least 8 characters" |
| 409 | "Email already registered" |

---

### POST /api/auth/login

Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "6654f1b2e3a1b4c5d6e7f8a9",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
Sets `refreshToken` httpOnly cookie (7 days).

**Errors:**
| Status | Message |
|--------|---------|
| 401 | "Invalid email or password" |

---

### POST /api/auth/refresh

Exchange a refresh token cookie for a new access token. The old refresh token is consumed and a new one is issued.

**Request:** No body. Reads `refreshToken` from httpOnly cookie.

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
Sets new `refreshToken` httpOnly cookie.

**Errors:**
| Status | Message |
|--------|---------|
| 401 | "Refresh token missing" |
| 401 | "Refresh token invalid or expired" |

---

### POST /api/auth/logout

Invalidate the current session.

**Request:** No body. Reads `refreshToken` from httpOnly cookie.

**Response 200:**
```json
{ "success": true }
```
Clears `refreshToken` cookie.

---

### GET /api/auth/me

Get the currently authenticated user.

**Auth:** Required

**Response 200:**
```json
{
  "user": {
    "id": "6654f1b2e3a1b4c5d6e7f8a9",
    "email": "user@example.com",
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
}
```

---

### POST /api/auth/forgot-password

Request a password reset email. Always returns 200 to avoid disclosing whether the email exists.

**Request:**
```json
{ "email": "user@example.com" }
```

**Response 200:**
```json
{ "message": "If that email exists, a reset link has been sent." }
```

---

### POST /api/auth/reset-password

Set a new password using the token from the reset email.

**Request:**
```json
{
  "token": "raw-reset-token-from-email-url",
  "password": "newpassword123"
}
```

**Response 200:**
```json
{ "message": "Password updated successfully." }
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | "Reset token is required." |
| 400 | "Password must be at least 8 characters." |
| 400 | "This reset link has expired or is invalid. Please request a new one." |

---

## 3. AI Chat Endpoint

### POST /api/chat

Send a message to the AI and receive a diagram update.

**Auth:** Required  
**Rate limit:** 10 requests / minute

**Request:**
```json
{
  "message": "Draw a TCP three-way handshake",
  "history": [
    { "role": "user", "content": "Draw a TCP three-way handshake" },
    { "role": "assistant", "content": "Here's a flowchart of the TCP handshake..." }
  ],
  "sceneJson": { "elements": [], "appState": {} },
  "theme": "default",
  "semanticState": {
    "domain": "networking",
    "diagramType": "tcp-handshake",
    "entities": [],
    "layoutConvention": { "layout": "flowchart", "direction": "TB" },
    "openThreads": [],
    "turnCount": 1
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's natural language prompt |
| `history` | array | Yes | Full conversation history (server trims to first + last 6) |
| `sceneJson` | object | Yes | Current Excalidraw scene |
| `theme` | string | No | `"minimal"` \| `"default"` \| `"vibrant"` (default: `"default"`) |
| `semanticState` | object | No | Current semantic context; returned updated |

**Response 200:**
```json
{
  "reply": "I've drawn the TCP three-way handshake as a flowchart...",
  "sceneJson": { "elements": [ /* Excalidraw elements */ ], "appState": {} },
  "toolsUsed": ["plan_diagram"],
  "stages": ["Thinking...", "Asking AI...", "Planning diagram...", "Placing on canvas..."],
  "lastPlan": { /* DiagramPlan used — for visual feedback loop */ },
  "semanticState": { /* Updated semantic context */ },
  "embeddedImages": [ /* Present only for show_me intent */ ]
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 400 | "Message is required" |
| 429 | Rate limit exceeded |
| 503 | "AI service unavailable — please try again" |

---

## 4. Document Ingest Endpoint

### POST /api/ingest

Convert a text document or code file into a diagram.

**Auth:** Required

**Request:**
```json
{
  "content": "import express from 'express'\nimport { Router } from 'express'\n...",
  "filename": "routes/auth.ts",
  "semanticState": { /* optional */ }
}
```

**Validation:**
- `content`: min 10 chars, max 12,000 chars
- `filename`: max 200 chars, must match `/^[\w\-. ]+$/`
- Content with prompt injection patterns (`"ignore previous instructions"`, etc.) → 400

**Response 200:**
```json
{
  "reply": "Here's the structure of your auth routes file...",
  "sceneJson": { "elements": [ /* Excalidraw elements */ ], "appState": {} },
  "toolsUsed": ["plan_diagram"],
  "stages": ["Reading document...", "Analysing structure...", "Building diagram..."],
  "semanticState": { /* Updated */ }
}
```

---

## 5. Visual Critique Endpoint

### POST /api/critique

Submit a rendered canvas PNG for AI visual review. Returns a corrected scene if issues are found.

**Auth:** Required

**Request:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "lastPlan": { /* DiagramPlan object from the last /api/chat response */ }
}
```

**Response 200:**
```json
{
  "hasIssues": true,
  "issues": ["Text overflow in node 'API Gateway'", "Nodes 'DB' and 'Cache' overlap"],
  "corrected": true,
  "sceneJson": { "elements": [ /* corrected elements */ ], "appState": {} }
}
```

If `hasIssues` is false or correction fails:
```json
{
  "hasIssues": false,
  "issues": [],
  "corrected": false,
  "sceneJson": null
}
```

---

## 6. Drawings Endpoints

### GET /api/drawings

List all drawings for the authenticated user.

**Auth:** Required  
**Query params:** `?folderId=<id>` (optional filter), `?search=<text>` (optional full-text search)

**Response 200:**
```json
[
  {
    "_id": "6654f1b2e3a1b4c5d6e7f8a9",
    "title": "TCP Handshake",
    "thumbnail": "data:image/png;base64,...",
    "folderId": null,
    "tags": ["networking", "tcp"],
    "isPublic": false,
    "createdAt": "2026-06-15T10:00:00.000Z",
    "updatedAt": "2026-06-15T11:30:00.000Z"
  }
]
```

---

### POST /api/drawings

Create a new drawing.

**Auth:** Required

**Request:**
```json
{
  "title": "My New Diagram",
  "sceneJson": { "elements": [], "appState": {} },
  "conversationHistory": [],
  "semanticState": null,
  "folderId": null,
  "tags": ["architecture"],
  "thumbnail": "data:image/png;base64,..."
}
```

**Response 201:**
```json
{
  "_id": "6654f1b2e3a1b4c5d6e7f8a9",
  "title": "My New Diagram",
  "userId": "...",
  "createdAt": "2026-06-20T14:00:00.000Z",
  "updatedAt": "2026-06-20T14:00:00.000Z"
}
```

---

### GET /api/drawings/:id

Load a specific drawing with full scene and conversation history.

**Auth:** Required (must be owner)

**Response 200:**
```json
{
  "_id": "6654f1b2e3a1b4c5d6e7f8a9",
  "title": "TCP Handshake",
  "sceneJson": { "elements": [ /* ... */ ], "appState": {} },
  "conversationHistory": [ /* ... */ ],
  "semanticState": { /* ... */ },
  "folderId": null,
  "tags": ["networking"],
  "isPublic": false,
  "thumbnail": "data:image/png;base64,...",
  "createdAt": "2026-06-15T10:00:00.000Z",
  "updatedAt": "2026-06-15T11:30:00.000Z"
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 404 | "Drawing not found" |

---

### PATCH /api/drawings/:id

Update a drawing (save).

**Auth:** Required (must be owner)

**Request:** (all fields optional — only provided fields are updated)
```json
{
  "title": "Updated Title",
  "sceneJson": { "elements": [ /* ... */ ], "appState": {} },
  "conversationHistory": [ /* ... */ ],
  "semanticState": { /* ... */ },
  "folderId": "6654f1b2e3a1b4c5d6e7f8a0",
  "tags": ["networking", "updated"],
  "thumbnail": "data:image/png;base64,..."
}
```

**Response 200:** Updated drawing object (same shape as GET).

**Side effect:** Creates a `DrawingVersion` snapshot. If version count exceeds 20, oldest is deleted.

---

### POST /api/drawings/:id/share

Toggle the public share link for a drawing.

**Auth:** Required (must be owner)

**Request:** No body.

**Response 200:**
```json
{
  "shareId": "V1StGXR8_Z5jdHi6B-myT",
  "shareUrl": "https://your-frontend.vercel.app/share/V1StGXR8_Z5jdHi6B-myT",
  "isPublic": true
}
```

If already shared, the existing `shareId` is returned. Calling again toggles `isPublic` off and removes the `shareId`.

---

## 7. Version Endpoints

### GET /api/drawings/:id/versions

List all saved versions for a drawing, newest first.

**Auth:** Required (must be owner)

**Response 200:**
```json
[
  {
    "_id": "6654f1b2e3a1b4c5d6e7f8b1",
    "versionNumber": 5,
    "label": "Added Redis layer",
    "elementCount": 12,
    "createdAt": "2026-06-20T14:32:00.000Z"
  },
  {
    "_id": "6654f1b2e3a1b4c5d6e7f8b0",
    "versionNumber": 4,
    "label": "Auto-save",
    "elementCount": 9,
    "createdAt": "2026-06-20T14:28:00.000Z"
  }
]
```

---

### POST /api/drawings/:id/versions/:versionId/restore

Restore a drawing to a previous version.

**Auth:** Required (must be owner)

**Request:** No body.

**Response 200:**
```json
{
  "sceneJson": { "elements": [ /* snapshot elements */ ], "appState": {} },
  "conversationHistory": [ /* snapshot history */ ],
  "versionNumber": 3,
  "label": "Refine layout"
}
```

---

## 8. Folder Endpoints

### GET /api/folders

List all folders for the authenticated user.

**Auth:** Required

**Response 200:**
```json
[
  {
    "_id": "6654f1b2e3a1b4c5d6e7f8c0",
    "name": "Architecture Diagrams",
    "color": "#6366f1",
    "createdAt": "2026-06-10T09:00:00.000Z"
  }
]
```

---

### POST /api/folders

Create a new folder.

**Auth:** Required

**Request:**
```json
{
  "name": "My Folder",
  "color": "#10b981"
}
```

**Validation:**
- `name`: required, max 50 chars
- `color`: optional, defaults to `#6366f1`

**Response 201:** Created folder object.

---

### PATCH /api/folders/:id

Update folder name or colour.

**Auth:** Required (must be owner)

**Request:** (all fields optional)
```json
{
  "name": "Renamed Folder",
  "color": "#f59e0b"
}
```

**Response 200:** Updated folder object.

---

### DELETE /api/folders/:id

Delete a folder. Drawings inside are moved to unfiled (folderId set to null).

**Auth:** Required (must be owner)

**Response 200:**
```json
{ "success": true }
```

---

## 9. Share Endpoint (Public)

### GET /api/share/:shareId

Load a shared drawing. No authentication required.

**Response 200:**
```json
{
  "title": "TCP Handshake",
  "sceneJson": { "elements": [ /* ... */ ], "appState": {} }
}
```

**Errors:**
| Status | Message |
|--------|---------|
| 404 | "Drawing not found or sharing disabled" |

---

## 10. Image Search Endpoint

### POST /api/images

Search Pexels for reference images. Used internally by the AI for the `fetch_images` tool call.

**Auth:** Required

**Request:**
```json
{ "query": "human heart anatomy" }
```

**Response 200:**
```json
{
  "images": [
    {
      "url": "https://images.pexels.com/photos/...",
      "alt": "Human heart anatomy diagram",
      "photographer": "Example Photographer"
    }
  ]
}
```

If `PEXELS_API_KEY` is not set:
```json
{ "images": [] }
```

---

## 11. Health Endpoint

### GET /api/health

Server health check. No authentication required.

**Response 200:**
```json
{ "status": "ok" }
```
