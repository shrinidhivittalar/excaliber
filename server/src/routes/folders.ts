import { Router } from "express";
import mongoose from "mongoose";
import { Folder } from "../models/Folder";
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const folders = await Folder.find({ userId })
    .sort({ name: 1 })
    .lean();

  const counts = await Drawing.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId), folderId: { $ne: null } } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);

  const countByFolderId = new Map(
    counts.map((row) => [row._id.toString(), row.count])
  );

  res.json(
    folders.map((folder) => ({
      ...folder,
      drawingCount: countByFolderId.get(folder._id.toString()) ?? 0,
    }))
  );
});

router.post("/", async (req: AuthRequest, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const color =
    typeof req.body.color === "string" ? req.body.color : undefined;

  if (name.length < 1 || name.length > 50) {
    res.status(400).json({ error: "Folder name must be 1-50 characters" });
    return;
  }

  const duplicate = await Folder.findOne({
    userId: req.userId,
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
  });
  if (duplicate) {
    res.status(409).json({ error: "A folder with this name already exists" });
    return;
  }

  const folder = await Folder.create({
    name,
    color,
    userId: req.userId,
  });

  res.status(201).json(folder);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (req.body.name !== undefined) {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name.length < 1 || name.length > 50) {
      res.status(400).json({ error: "Folder name must be 1-50 characters" });
      return;
    }

    const duplicate = await Folder.findOne({
      userId: req.userId,
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
    });
    if (duplicate) {
      res.status(409).json({ error: "A folder with this name already exists" });
      return;
    }

    updates.name = name;
  }

  if (req.body.color !== undefined) {
    if (typeof req.body.color !== "string") {
      res.status(400).json({ error: "color must be a string" });
      return;
    }
    updates.color = req.body.color;
  }

  const folder = await Folder.findOneAndUpdate(
    { _id: id, userId: req.userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(folder);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = paramId(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  const folder = await Folder.findOneAndDelete({ _id: id, userId: req.userId });
  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  await Drawing.updateMany(
    { userId: req.userId, folderId: id },
    { $set: { folderId: null } }
  );

  res.json({ success: true });
});

export default router;
