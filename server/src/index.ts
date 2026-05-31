import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initMcp } from "./mcp/client";
import chatRoutes from "./routes/chat";
import clearRoutes from "./routes/clear";
import imagesRoutes from "./routes/images";
import healthRoutes from "./routes/health";

const app = express();
const PORT = process.env.PORT || 3001;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/clear", clearRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/health", healthRoutes);

async function startServer() {
  await initMcp();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
