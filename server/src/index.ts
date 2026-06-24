import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { validateEnv } from './lib/validateEnv'
validateEnv()

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { requestIdMiddleware } from "./middleware/requestId";
import { connectDB } from "./db/connect";
import { initMcp } from "./mcp/client";
import { logger } from "./lib/logger";
import chatRoutes from "./routes/chat";
import clearRoutes from "./routes/clear";
import imagesRoutes from "./routes/images";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import drawingsRoutes from "./routes/drawings";
import foldersRoutes from "./routes/folders";
import versionsRoutes from "./routes/versions";
import shareRoutes from "./routes/share";
import ingestRoutes from "./routes/ingest"
import critiqueRoutes from "./routes/critique";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGIN) {
  process.stderr.write(
    '[STARTUP ERROR] ALLOWED_ORIGIN must be set in production.\n'
  );
  process.exit(1);
}

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", allowedOrigin],
    },
  },
  frameguard: { action: 'deny' },
}));
app.use(requestIdMiddleware);
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// express-mongo-sanitize reassigns req.query, which is getter-only in Express 5.
// Sanitize mutable request parts only.
app.use((req, _res, next) => {
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body as Record<string, unknown>);
  }

  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params as Record<string, unknown>) as typeof req.params;
  }

  next();
});

app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/clear", clearRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/drawings", versionsRoutes);
app.use("/api/drawings", drawingsRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/ingest", ingestRoutes);
app.use("/api/critique", critiqueRoutes);

async function startServer() {
  await connectDB();
  await initMcp();

  if (!process.env.PEXELS_API_KEY) {
    logger.warn('pexels_missing',
      { message: 'PEXELS_API_KEY not set — fetch_images will return empty arrays' }
    )
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    logger.info("server_started", { port: PORT });
  });
}

startServer().catch((error) => {
  logger.error('server_start_failed', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
