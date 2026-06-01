import { Router } from "express";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { Drawing } from "../models/Drawing";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get("/", async (req: AuthRequest, res) => {
  const drawings = await Drawing.find({ userId: req.userId })
    .select("_id title updatedAt createdAt isPublic shareId")
    .sort({ updatedAt: -1 })
    .lean();

  res.json(drawings);
});

router.get("/:id", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  const drawing = await Drawing.findOne({ _id: id, userId: req.userId });
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  res.json(drawing);
});

router.post("/", async (req: AuthRequest, res) => {
  const { title, sceneJson, conversationHistory } = req.body;

  if (sceneJson === undefined || sceneJson === null) {
    res.status(400).json({ error: "sceneJson is required" });
    return;
  }

  const drawing = await Drawing.create({
    title,
    sceneJson,
    conversationHistory,
    userId: req.userId,
  });

  res.status(201).json(drawing);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  const { title, sceneJson, conversationHistory } = req.body;
  const updates: Record<string, unknown> = {};

  if (title !== undefined) updates.title = title;
  if (sceneJson !== undefined) updates.sceneJson = sceneJson;
  if (conversationHistory !== undefined) {
    updates.conversationHistory = conversationHistory;
  }

  const drawing = await Drawing.findOneAndUpdate(
    { _id: id, userId: req.userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  res.json(drawing);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  const result = await Drawing.deleteOne({ _id: id, userId: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  res.json({ success: true });
});

router.post("/:id/share", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  const drawing = await Drawing.findOne({ _id: id, userId: req.userId });
  if (!drawing) {
    res.status(404).json({ error: "Drawing not found" });
    return;
  }

  if (!drawing.shareId) {
    drawing.shareId = nanoid(10);
    drawing.isPublic = true;
  } else {
    drawing.isPublic = !drawing.isPublic;
  }

  await drawing.save();
  res.json({ shareId: drawing.shareId, isPublic: drawing.isPublic });
});

export default router;
