# AI Drawing Engine

A conversational AI that draws on an Excalidraw canvas using Gemini and Excalidraw MCP.

## Setup

### 1. Get API Keys
- **Gemini**: Go to https://aistudio.google.com → Get API Key → Free tier
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

## Architecture
- Frontend: React + Vite + Excalidraw + shadcn/ui
- Backend: Node.js + Express
- AI: Google Gemini 2.0 Flash (free tier — 1500 req/day)
- Drawing: Excalidraw MCP (official MCP server)
- Images: Pexels API (free — 200 req/hour)

## Example Prompts
- "Show the lifecycle of water evaporation and condensation"
- "Draw how a TCP/IP handshake works"
- "Visualise merge sort step by step"
- "Map the layers of the Earth"
- "Show me the Krebs cycle"
