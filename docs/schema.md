# Excaliber — Database Schema Documentation

**Version**: 1.0  
**Database**: MongoDB 7 (Atlas)  
**ODM**: Mongoose 8  
**Last Updated**: June 2026

---

## 1. Entity Relationship Overview

```
User ─────────────────────────────────────────────────────────────────
  │                                                                   │
  │ (owns)                         (owns)                            │
  │                                    │                             │
  ▼                                    ▼                             │
Drawing ◄──────────── DrawingVersion   Folder                        │
  │                        │                                         │
  │  (has many)            │  (snapshot of Drawing at a point        │
  │                        │   in time)                              ▼
  │                                                          RefreshToken
  │                                                          PasswordResetToken
  │
  ├── conversationHistory[]     (embedded array)
  ├── semanticState             (embedded object)
  └── sceneJson                 (embedded Excalidraw scene)
```

---

## 2. Collection Definitions

### 2.1 `users`

Core identity collection. Every account that can log in is a User.

```typescript
const UserSchema = new Schema({
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  hashedPassword: { type: String, required: true },
}, { timestamps: true })
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `email` | String | unique, lowercase, trimmed | User's email address |
| `hashedPassword` | String | required | bcrypt hash (12 rounds) |
| `createdAt` | Date | auto | Account creation timestamp |
| `updatedAt` | Date | auto | Last update timestamp |

**Indexes:**
```
{ email: 1 }    — unique index (enforced by `unique: true`)
```

---

### 2.2 `drawings`

Primary content collection. Each document represents one user's drawing — it stores the full Excalidraw scene, conversation history, and metadata.

```typescript
const DrawingSchema = new Schema({
  title:               { type: String, default: 'Untitled Drawing', maxlength: 100 },
  sceneJson:           { type: Schema.Types.Mixed },
  conversationHistory: { type: [Schema.Types.Mixed], default: [] },
  semanticState:       { type: Schema.Types.Mixed, default: null },
  userId:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shareId:             { type: String, sparse: true },
  isPublic:            { type: Boolean, default: false },
  folderId:            { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
  tags:                { type: [String], default: [], validate: v => v.length <= 10 },
  thumbnail:           { type: String },
}, { timestamps: true })
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | Document ID |
| `title` | String | max 100 chars, default "Untitled Drawing" | Drawing name |
| `sceneJson` | Mixed | — | Full Excalidraw scene object (elements, appState) |
| `conversationHistory` | Mixed[] | — | Array of `{role, content}` chat messages |
| `semanticState` | Mixed | — | AI conversation context (entities, layout, threads, domain) |
| `userId` | ObjectId | ref User, required | Owner of this drawing |
| `shareId` | String | sparse (only when shared) | Nanoid used in public share URL |
| `isPublic` | Boolean | default false | Whether drawing is accessible via share link |
| `folderId` | ObjectId | ref Folder, nullable | Assigned folder (null = unfiled) |
| `tags` | String[] | max 10 items | Full-text searchable tags |
| `thumbnail` | String | — | Base64 data URL (max 400px) for dashboard preview |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Indexes:**
```
{ userId: 1 }                    — list drawings by owner (most common query)
{ shareId: 1 }                   — sparse unique index for share link lookup
{ folderId: 1 }                  — filter drawings by folder
{ userId: 1, title: 'text', tags: 'text' }  — full-text search across title + tags
```

---

### 2.3 `drawingversions`

Snapshot collection. Every save (manual or auto) creates one version. Maximum 20 versions per drawing — oldest pruned on creation of the 21st.

```typescript
const DrawingVersionSchema = new Schema({
  drawingId:           { type: Schema.Types.ObjectId, ref: 'Drawing', required: true },
  userId:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
  versionNumber:       { type: Number, required: true },
  label:               { type: String, default: 'Auto-save', maxlength: 60 },
  sceneJson:           { type: Schema.Types.Mixed },
  conversationHistory: { type: [Schema.Types.Mixed], default: [] },
  elementCount:        { type: Number, default: 0 },
}, { timestamps: true })
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | — |
| `drawingId` | ObjectId | ref Drawing, required | Parent drawing |
| `userId` | ObjectId | ref User, required | Owner |
| `versionNumber` | Number | increments per drawing | Sequential version number within a drawing |
| `label` | String | max 60 chars, default "Auto-save" | Auto-generated from last user message (truncated to 40 chars) |
| `sceneJson` | Mixed | — | Canvas snapshot at time of save |
| `conversationHistory` | Mixed[] | — | Chat history snapshot at time of save |
| `elementCount` | Number | — | Cached count of canvas elements in this snapshot |
| `createdAt` | Date | auto | Snapshot timestamp |

**Indexes:**
```
{ drawingId: 1 }                        — list versions for a drawing
{ drawingId: 1, versionNumber: 1 }      — compound unique index; used for max/min queries
{ drawingId: 1, createdAt: 1 }          — ordered version list
```

**Version Cap Logic (versions.ts):**
```
On save:
  1. Find max versionNumber for this drawingId
  2. Insert new version at maxVersion + 1
  3. Count total versions for this drawingId
  4. If count > 20: delete the version with min versionNumber
```

---

### 2.4 `folders`

Organises drawings into named, colour-coded collections.

```typescript
const FolderSchema = new Schema({
  name:   { type: String, required: true, maxlength: 50 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  color:  { type: String, default: '#6366f1' },
}, { timestamps: true })
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | — |
| `name` | String | max 50 chars, required | Folder display name |
| `userId` | ObjectId | ref User, required | Owner |
| `color` | String | default `#6366f1` (indigo) | Hex colour for UI indicator |
| `createdAt` | Date | auto | — |
| `updatedAt` | Date | auto | — |

**Indexes:**
```
{ userId: 1 }    — list folders by owner
```

**Note:** `drawingCount` is a virtual — computed by counting `Drawing.folderId` references at query time; not stored in the folder document.

---

### 2.5 `refreshtokens`

Persistent session tokens. One document per active session. Deleted on logout or rotation.

```typescript
const RefreshTokenSchema = new Schema({
  token:     { type: String, required: true, unique: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
})
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | — |
| `token` | String | unique | nanoid(64) — raw token stored here; never hashed (delivered only via httpOnly cookie over HTTPS) |
| `userId` | ObjectId | ref User | Token owner |
| `expiresAt` | Date | required | 7 days from creation |

**Indexes:**
```
{ token: 1 }       — unique lookup index (primary access pattern)
{ expiresAt: 1 }   — TTL index: MongoDB automatically deletes expired documents
```

**Rotation behaviour:**
```
POST /api/auth/refresh
    │
    findOneAndDelete({ token: oldToken })  — consumed immediately on use
    │
    createRefreshToken(userId)             — new token issued
    New document inserted
```

---

### 2.6 `passwordresettokens`

Short-lived tokens for the forgot-password flow.

```typescript
const PasswordResetTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
})
```

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | auto | — |
| `tokenHash` | String | unique | SHA-256 hash of the raw token. Raw token is emailed; hash stored here. |
| `userId` | ObjectId | ref User | Account being reset |
| `expiresAt` | Date | required | 1 hour from creation |

**Indexes:**
```
{ tokenHash: 1 }   — unique lookup index
{ expiresAt: 1 }   — TTL index: auto-deletes expired reset tokens
```

**Security note:** The raw token is only ever sent in the password reset email. The server stores only the SHA-256 hash. On verification:

```
rawToken received from URL
    │
    SHA-256 hash computed
    │
    PasswordResetToken.findOne({ tokenHash })
    │
    ├─ [Not found] ──► 400: "Link has expired or is invalid."
    ├─ [expiresAt < now] ──► Delete record + 400
    └─ [Valid] ──► Update User.hashedPassword + delete record
```

---

## 3. Embedded Data Structures

### 3.1 conversationHistory item

Stored in `Drawing.conversationHistory` and `DrawingVersion.conversationHistory`.

```typescript
{
  role:    "user" | "assistant",
  content: string                // plain text message
}
```

The server trims history to **first message + last 6 exchanges** before each AI call to manage token usage. Full history is stored in MongoDB regardless.

### 3.2 semanticState

Stored in `Drawing.semanticState`. Client-owned; round-tripped on every request.

```typescript
{
  domain:           string,      // "networking", "biology", "software/backend"
  diagramType:      string,      // "tcp-handshake", "microservices-architecture"
  entities: Array<{
    id:    string,               // Excalidraw element ID
    label: string,               // Node label as drawn
  }>,
  layoutConvention: {
    layout:    string,           // last used layout algorithm
    direction: string,           // "TB" or "LR"
  },
  openThreads: string[],         // entities mentioned but not yet drawn
  turnCount:   number,
}
```

### 3.3 sceneJson

Stores the full Excalidraw scene object. Structure defined by the Excalidraw library.

```typescript
{
  elements: ExcalidrawElement[],  // array of shape/text/arrow objects
  appState: {
    viewBackgroundColor: string,
    // ... other Excalidraw app state fields
  }
}
```

---

## 4. Data Retention Policies

| Collection | Retention Rule |
|------------|---------------|
| `drawings` | Retained indefinitely unless deleted by user |
| `drawingversions` | Max 20 per drawing — oldest pruned automatically on the 21st save |
| `refreshtokens` | TTL index: auto-deleted after 7 days; also deleted on logout and rotation |
| `passwordresettokens` | TTL index: auto-deleted after 1 hour; also deleted on successful reset |
| `users` | Retained indefinitely unless account deletion is implemented |
| `folders` | Retained indefinitely; drawings in a deleted folder move to unfiled |
