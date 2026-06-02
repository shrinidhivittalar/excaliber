import { Router } from "express";
import mongoose from "mongoose";
import { Drawing } from "../models/Drawing";
import { DrawingVersion } from "../models/DrawingVersion";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { createVersion } from "../services/versions";

const router = Router();

router.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getOwnedDrawing(drawingId: string, userId: string) {
  if (!isValidObjectId(drawingId)) {
    return null;
  }
  return Drawing.findOne({ _id: drawingId, userId });
}

router.get("/:id/versions", async (req: AuthRequest, res) => {
  const drawingId = paramId(req.params.id);
  const drawing = await getOwnedDrawing(drawingId, req.userId!);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  const versions = await DrawingVersion.find({ drawingId })
    .select("_id versionNumber label elementCount createdAt")
    .sort({ versionNumber: -1 })
    .lean();

  res.json(versions);
});

router.get("/:id/versions/:versionId", async (req: AuthRequest, res) => {
  const drawingId = paramId(req.params.id);
  const versionId = paramId(req.params.versionId);

  const drawing = await getOwnedDrawing(drawingId, req.userId!);
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  if (!isValidObjectId(versionId)) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  const version = await DrawingVersion.findOne({
    _id: versionId,
    drawingId,
    userId: req.userId,
  }).lean();

  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  res.json(version);
});

router.post(
  "/:id/versions/restore/:versionId",
  async (req: AuthRequest, res) => {
    const drawingId = paramId(req.params.id);
    const versionId = paramId(req.params.versionId);

    const drawing = await getOwnedDrawing(drawingId, req.userId!);
    if (!drawing) {
      res.status(404).json({ error: "Drawing not found" });
      return;
    }

    if (!isValidObjectId(versionId)) {
      res.status(404).json({ error: "Version not found" });
      return;
    }

    const version = await DrawingVersion.findOne({
      _id: versionId,
      drawingId,
      userId: req.userId,
    });

    if (!version) {
      res.status(404).json({ error: "Version not found" });
      return;
    }

    drawing.sceneJson = version.sceneJson;
    drawing.conversationHistory = version.conversationHistory;
    await drawing.save();

    await createVersion(
      drawing._id,
      req.userId!,
      drawing.sceneJson,
      drawing.conversationHistory,
      `Restored from v${version.versionNumber}`
    );

    res.json({ drawing });
  }
);

export default router;
