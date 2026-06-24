# Excaliber

AI-powered collaborative drawing engine for creating intelligent diagrams and visualizations.

## Overview

Excaliber combines **Excalidraw** for canvas interactions, **Groq** for fast AI reasoning, and **MongoDB** for persistent storage. Users describe what they want to draw in natural language, and the AI generates structured diagrams with smart layout, image embedding, and contextual understanding across conversation turns.

## Features

### Core Capabilities
- **AI-Powered Diagram Generation** — Natural language to structured drawings via Groq
- **7 Smart Layout Algorithms** — Hierarchical, force-directed, circular, tree, and more with configurable directions
- **Intelligent Image Embedding** — Fetch and embed reference photos from Pexels directly into diagrams
- **Conversation Context** — AI maintains semantic state across turns (domain, entities, open threads)
- **Theme System** — Dark/light modes with brand-safe color palettes
- **Version Control** — Save, restore, and track diagram evolution
- **Document Ingestion** — Extract diagrams from uploaded PDFs and images
- **Voice Input** — Speak your diagram intent (phase pending)

### Security & Scale
- **Authentication** — JWT-based login with refresh tokens
- **Rate Limiting** — Per-user chat, auth, and general API limits
- **Input Sanitization** — MongoDB query injection prevention
- **CORS & CSP** — Strict origin validation and content policies
- **Helmet** — HTTP security headers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, @excalidraw/excalidraw, TailwindCSS |
| **Backend** | Node.js, Express, TypeScript |
| **AI** | Groq API, Claude (vision, context) |
| **Database** | MongoDB |
| **External APIs** | Pexels (images), Excalidraw MCP |

## Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn
- MongoDB local or Atlas connection
- Groq API key
- Pexels API key (optional, for image embedding)

### Installation

```bash
# Clone and install
git clone https://github.com/your-org/excaliber.git
cd excaliber
npm install

# Create environment files
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Environment Variables

**Server (.env)**
```
NODE_ENV=development
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/excaliber

# APIs
GROQ_API_KEY=your_groq_key
PEXELS_API_KEY=your_pexels_key (optional)

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

**Client (.env)**
```
VITE_API_URL=http://localhost:3001/api
```

### Local Development

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd client
npm run dev
```

Open http://localhost:5173

## Architecture

### Request Flow
1. **Client** → Sends natural language + current drawing state to `/api/chat`
2. **Server** → Injects semantic state into Groq prompt
3. **Groq** → Classifies intent, generates layout plan, returns JSON
4. **Server** → If "show me" intent, fetches image from Pexels (if available)
5. **Client** → Applies changes, updates semantic state, re-renders

### Semantic State (Phase 9.0.4)

The AI maintains context across conversation turns without server-side memory:

```typescript
{
  domain: "software/backend",
  diagramType: "microservices-architecture",
  entities: [
    { name: "API Gateway", id: "elem-123" },
    { name: "Auth Service", id: "elem-456" }
  ],
  layoutUsed: "hierarchical",
  layoutDirection: "down",
  openThreads: ["add load balancing", "TLS later"],
  turnCount: 3
}
```

This state is:
- **Round-tripped** with every request (like sceneJson)
- **Validated** and updated by the server
- **Persisted** in MongoDB alongside the drawing
- **Restored** when a saved diagram is opened

### Image Embedding Pipeline (Phase 9.0.2)

1. Groq generates layout with "show me [subject]" intent
2. Server queries Pexels API for matching image
3. Image downloaded and base64-encoded (150KB max)
4. Client registers image via Excalidraw's native `addFiles()` API
5. Image placed centered; annotations positioned radially around it
6. Dashed arrows point from annotations inward to image

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGIN` to your frontend domain
- [ ] Use a shared Redis instance for rate limiting (if multi-instance)
- [ ] Enable MongoDB replica set for sessions (if multi-instance)
- [ ] Review JWT secrets and auth token expiry
- [ ] Enable HTTPS in production

### Rate Limiting (Single Instance)

Currently enforced in-memory per instance:
- **Chat**: 10 requests per 60 seconds
- **Auth**: 10 attempts per 15 minutes

**Note**: If deploying with multiple instances or auto-scaling, migrate limits to Redis to prevent silent limit multiplication.

### Render Deployment

1. Connect GitHub repo
2. Set environment variables in Render dashboard
3. Build command: `npm run build`
4. Start command: `npm start`
5. Redeploy if `ALLOWED_ORIGIN` is updated

## Project Status

| Phase | Feature | Status |
|-------|---------|--------|
| 9.0.2 | Image Embedding | ✅ Complete |
| 9.0.4 | Semantic State | ✅ Complete |
| 9.0.5 | Server-Sent Events | 🔄 In Progress |
| 10.0 | Security Hardening | 🔄 In Progress |

## License

MIT
