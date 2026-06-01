import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { connectDB } from "./db/connect";
import { initMcp } from "./mcp/client";
import chatRoutes from "./routes/chat";
import clearRoutes from "./routes/clear";
import imagesRoutes from "./routes/images";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import drawingsRoutes from "./routes/drawings";
import shareRoutes from "./routes/share";

const app = express();
const PORT = process.env.PORT || 3001;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/clear", clearRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/drawings", drawingsRoutes);
app.use("/api/share", shareRoutes);

async function startServer() {
  await connectDB();
  await initMcp();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
