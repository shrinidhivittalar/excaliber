# Excaliber

> **An AI-powered diagramming engine** — describe a concept in plain English and Excaliber draws it on an interactive canvas in seconds.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248)](https://www.mongodb.com/)

---

## Table of Contents

- [Overview](#overview)
- [Documentation Index](#documentation-index)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Deployment](#deployment)

---

## Overview

Excaliber is a full-stack application where users chat with an AI to generate structured diagrams on an Excalidraw canvas. Unlike traditional tools where users drag and position every shape, Excaliber handles all layout, positioning, and routing automatically.

A custom server-side layout engine translates the AI's semantic plan (nodes, edges, layout type) into precise Excalidraw element coordinates — the LLM never touches pixel positions.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| Natural language → diagram | Type or speak a description; the AI generates a fully laid-out diagram |
| 7 layout algorithms | Flowchart, hierarchy, circular, comparison, timeline, mindmap, freeform |
| Document ingestion | Drop a code file, markdown, JSON, or CSV — Excaliber diagrams its structure |
| Voice input | Browser-native Speech API, auto-submits after 600ms of silence |
| Intent detection | Client-side classifier auto-switches theme and strategy per message intent |
| Visual feedback loop | Vision AI critiques the rendered PNG and silently corrects layout issues |
| Version history | Automatic snapshots on every save, restorable in one click |
| Sharing | Public read-only share link per drawing |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [`PRD.md`](./PRD.md) | Product requirements, features, engineering decisions, future scope |
| [`appflow.md`](./appflow.md) | Screen-by-screen user flows and navigation maps |
| [`architecture.md`](./architecture.md) | System architecture, AI pipeline, layout engine, deployment |
| [`data_API.md`](./data_API.md) | Complete REST API reference with request/response examples |
| [`schema.md`](./schema.md) | MongoDB schema definitions, indexes, and data relationships |
| [`phase_scope.md`](./phase_scope.md) | Phased roadmap and sprint-level deliverables |
| [`README.md`](./README.md) | ← You are here |

---

## Tech Stack

### Frontend (`client/`)

| Tech | Version | Purpose |
|------|---------|---------|
| React | 18 | UI framework |
| Vite | 6.x | Build tool and dev server |
| TypeScript | 5.x | Type safety |
| Excalidraw | latest | Interactive canvas rendering |
| shadcn/ui | latest | UI component library |
| Tailwind CSS | 3.x | Utility-first styling |

### Backend (`server/`)

| Tech | Version | Purpose |
|------|---------|---------|
| Node.js | 22 LTS | Runtime |
| Express.js | 5.x | HTTP framework |
| TypeScript | 5.x | Type safety |
| Mongoose | 8.x | MongoDB ODM |
| Groq SDK | latest | LLM inference (llama-3.3-70b-versatile) |
| Zod | 3.x | Input validation and schema definition |
| bcrypt | 6.x | Password hashing |
| jsonwebtoken | 9.x | JWT access and refresh tokens |
| helmet | latest | HTTP security headers |
| express-rate-limit | 7.x | IP and per-user rate limiting |
| express-mongo-sanitize | latest | NoSQL injection prevention |
| nodemailer | 9.x | Password reset emails |

### Infrastructure

| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Managed database |
| Vercel | Frontend hosting |
| Render | Backend hosting |
| Pexels API | Real-world image search for canvas embedding |

---

## Project Structure

```
Excaliber/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── CanvasPage.tsx          # Main canvas page orchestrator
│       │   ├── DashboardPage.tsx       # Drawing list, folders, search
│       │   ├── SharePage.tsx           # Public read-only drawing view
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── ForgotPasswordPage.tsx
│       │   └── ResetPasswordPage.tsx
│       ├── components/
│       │   ├── CommandBar.tsx          # Pill-bar chat UI (text, voice, file)
│       │   ├── CanvasActions.tsx       # Top-right canvas toolbar
│       │   ├── NodePanel.tsx           # Click-to-explain selected node
│       │   └── ui/                     # shadcn/ui components
│       ├── hooks/
│       │   └── useDrawingApp.ts        # All app state: chat, scene, save, versions
│       ├── lib/
│       │   ├── api.ts                  # Typed API client
│       │   ├── detectIntent.ts         # Client-side intent classifier
│       │   └── auth.ts                 # Token management, interceptors
│       └── types/
│           └── index.ts                # Shared TypeScript types
│
├── server/
│   └── src/
│       ├── index.ts                    # Express app bootstrap
│       ├── ai/
│       │   ├── groq.ts                 # AI orchestration, tool-calling loop
│       │   ├── vision.ts               # Visual critique via llama-4-scout
│       │   ├── systemPrompt.ts         # System and ingest prompts
│       │   └── layout/                 # Layout engine (7 algorithms)
│       │       ├── index.ts            # Orchestrator: DiagramPlan → elements
│       │       ├── converter.ts        # Plan → Excalidraw element format
│       │       ├── edge-router.ts      # Smart arrow routing
│       │       ├── themes.ts           # 3 color palettes
│       │       ├── sizing.ts           # Dynamic node sizing
│       │       ├── validation.ts       # Zod schema validation
│       │       └── algorithms/         # One file per layout type
│       ├── routes/                     # Express route handlers
│       ├── models/                     # Mongoose schemas
│       ├── middleware/                 # Auth, rate limiting, request ID
│       ├── auth/
│       │   └── tokens.ts               # JWT sign/verify + refresh rotation
│       ├── services/
│       │   ├── images.ts               # Pexels API wrapper
│       │   ├── versions.ts             # Snapshot creation and restoration
│       │   ├── tokenBudget.ts          # Daily per-user token limit
│       │   └── email.ts                # Password reset email
│       ├── mcp/
│       │   └── client.ts               # Excalidraw MCP bridge
│       └── lib/
│           ├── logger.ts               # Structured JSON logger
│           ├── retry.ts                # withRetry + withTimeout wrappers
│           └── validateEnv.ts          # Startup environment validation
│
├── render.yaml                         # Render deployment config (backend)
├── vercel.json                         # Vercel deployment config (frontend)
└── package.json                        # Root workspace
```

---

## Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Node.js | 22 LTS | [nodejs.org](https://nodejs.org) |
| npm | 10.x | Bundled with Node.js |
| MongoDB | 7+ or Atlas | Local or managed |
| Groq API key | — | Free at [console.groq.com](https://console.groq.com) |
| Pexels API key | — | Optional — free at [pexels.com/api](https://www.pexels.com/api/) |

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/Excaliber.git
cd Excaliber
```

### 2. Install dependencies

```bash
# Root workspace
npm install

# Backend
cd server && npm install && cd ..

# Frontend
cd client && npm install && cd ..
```

### 3. Set up environment variables

```bash
cp server/.env.example server/.env
```

Fill in the required values (see [Environment Variables](#environment-variables) below).

### 4. Start the development servers

```bash
# Start both client and server concurrently (from root)
npm run dev
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend (Vite) on `http://localhost:5173`

### 5. Verify setup

```bash
# Health check
curl http://localhost:3001/api/health
# Expected: { "status": "ok" }
```

Open `http://localhost:5173` — you should see the Excaliber login page.

---

## Environment Variables

### `server/.env`

```env
# Server
NODE_ENV=development
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/excaliber

# Groq AI
GROQ_API_KEY=gsk_your_groq_api_key_here

# JWT Secrets (generate with: openssl rand -hex 32)
JWT_ACCESS_SECRET=your-access-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-chars
JWT_ACCESS_EXPIRES=15m

# CORS (comma-separated origins in production)
CLIENT_URL=http://localhost:5173

# Pexels (optional — enables real image embedding)
PEXELS_API_KEY=your_pexels_api_key

# Token budget per user per day (default: 100000)
DAILY_TOKEN_LIMIT=100000

# Rate limiting
USER_RATE_LIMIT_COUNT=10
USER_RATE_LIMIT_MS=60000

# Password reset email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

> **Note**: Never commit `.env` files. They are listed in `.gitignore`.

---

## Running the Application

### Development (hot reload)

```bash
npm run dev        # From root — starts client + server concurrently
```

### Production build

```bash
# Build server
cd server && npm run build

# Build client
cd client && npm run build

# Start server
cd server && npm start
```

### Individual services

```bash
# Backend only
cd server && npm run dev

# Frontend only
cd client && npm run dev
```

---

## Deployment

### Frontend — Vercel

The client deploys automatically to Vercel on push to `main`.

Config: `vercel.json` at the project root routes `/api/*` to the Render backend and serves the built client for all other paths.

### Backend — Render

The server deploys automatically to Render on push to `main`.

Config: `render.yaml` at the project root defines the web service, build command, and start command.

```bash
# Build command (Render)
npm install --include=dev && npm run build

# Start command (Render)
node dist/index.js
```

Set all environment variables in the Render dashboard under the service's **Environment** tab.

---

*Built as an internship project — Excaliber Engineering, June 2026.*
