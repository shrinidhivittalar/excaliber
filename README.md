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

## V2 Setup (MongoDB + Auth)

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

## New Features (V2)
- Create account and sign in with email + password
- Save drawings to your account
- Load and continue any saved drawing
- Share drawings via a public link
- Dashboard showing all your saved drawings

## V3 Features

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
- Build command: `npm run build --workspace=server`
- Start command: `npm run start --workspace=server`
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
