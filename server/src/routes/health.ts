import { Router } from "express";
import mongoose from "mongoose";
import { isMcpAvailable } from "../mcp/client";

const router = Router();

router.get("/", async (_req, res) => {
  const mongoState  = mongoose.connection.readyState
  const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected'
  const isHealthy   = mongoStatus === 'connected'

  const payload = {
    status:  isHealthy ? 'ok' : 'degraded',
    uptime:  Math.round(process.uptime()),
    ts:      Date.now(),
    version: process.env.npm_package_version ?? 'unknown',
    mongo:   mongoStatus,
    mcp:     isMcpAvailable ? 'connected' : 'unavailable',
    memory:  `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  }

  res.status(isHealthy ? 200 : 503).json(payload)
});

export default router;
