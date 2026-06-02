import { Router } from "express";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { Drawing } from "../models/Drawing";
import { Folder } from "../models/Folder";
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTags(tags: unknown): string[] | null {
  if (!Array.isArray(tags)) {
    return null;
  }
  return tags.map((tag) => String(tag).trim()).filter(Boolean);
}

async function resolveFolderId(
  folderId: unknown,
  userId: string
): Promise<mongoose.Types.ObjectId | null | undefined> {
  if (folderId === undefined) {
    return undefined;
  }
  if (folderId === null || folderId === "") {
    return null;
  }
  const id = String(folderId);
  if (!isValidObjectId(id)) {
    return null;
  }
  const folder = await Folder.findOne({ _id: id, userId });
  return folder ? folder._id : null;
}

function buildListFilter(
  userId: string,
  query: AuthRequest["query"],
  options?: { skipSearch?: boolean }
): Record<string, unknown> {
  const filter: Record<string, unknown> = { userId };

  const folderId = typeof query.folderId === "string" ? query.folderId : undefined;
  if (folderId && folderId !== "all") {
    if (folderId === "null") {
      filter.folderId = null;
    } else if (isValidObjectId(folderId)) {
      filter.folderId = folderId;
    }
  }

  const tag = typeof query.tag === "string" ? query.tag.trim() : undefined;
  if (tag) {
    filter.tags = { $regex: new RegExp(`^${escapeRegex(tag)}$`, "i") };
  }

  if (!options?.skipSearch) {
    const q = typeof query.q === "string" ? query.q.trim() : undefined;
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        { $or: [{ title: regex }, { tags: regex }] },
      ];
    }
  }

  return filter;
}

function versionLabelFromHistory(
  conversationHistory: unknown[],
  fallback: string
): string {
  if (!Array.isArray(conversationHistory)) {
    return fallback;
  }

  const userMessages = conversationHistory.filter(
    (message): message is { role: string; content: string } =>
      !!message &&
      typeof message === "object" &&
      (message as { role?: string }).role === "user" &&
      typeof (message as { content?: unknown }).content === "string"
  );

  const lastMessage = userMessages.at(-1);
  if (!lastMessage) {
    return fallback;
  }

  const content = lastMessage.content.trim();
  if (!content) {
    return fallback;
  }

  return content.length > 40 ? `${content.slice(0, 40)}...` : content;
}

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const baseFilter = buildListFilter(userId, req.query, { skipSearch: true });
  const select =
    "_id title updatedAt createdAt isPublic shareId folderId tags";

  let drawings;

  if (q) {
    try {
      drawings = await Drawing.find(
        { ...baseFilter, $text: { $search: q } },
        { score: { $meta: "textScore" } }
      )
        .select(select)
        .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
        .lean();
    } catch {
      const regex = new RegExp(escapeRegex(q), "i");
      drawings = await Drawing.find({
        ...baseFilter,
        $or: [{ title: regex }, { tags: regex }],
      })
        .select(select)
        .sort({ updatedAt: -1 })
        .lean();
    }
  } else {
    drawings = await Drawing.find(baseFilter)
      .select(select)
      .sort({ updatedAt: -1 })
      .lean();
  }

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

  const tags = normalizeTags(req.body.tags);
  if (tags === null && req.body.tags !== undefined) {
    res.status(400).json({ error: "tags must be an array of strings" });
    return;
  }

  const folderId = await resolveFolderId(req.body.folderId, req.userId!);
  if (req.body.folderId !== undefined && req.body.folderId !== null && !folderId) {
    res.status(400).json({ error: "Invalid folderId" });
    return;
  }

  const drawing = await Drawing.create({
    title,
    sceneJson,
    conversationHistory,
    userId: req.userId,
    ...(tags !== null ? { tags } : {}),
    ...(folderId !== undefined ? { folderId } : {}),
  });

  await createVersion(
    drawing._id,
    req.userId!,
    drawing.sceneJson,
    drawing.conversationHistory,
    "Initial save"
  );

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

  if (req.body.folderId !== undefined) {
    const folderId = await resolveFolderId(req.body.folderId, req.userId!);
    if (req.body.folderId !== null && req.body.folderId !== "" && !folderId) {
      res.status(400).json({ error: "Invalid folderId" });
      return;
    }
    updates.folderId = folderId ?? null;
  }

  if (req.body.tags !== undefined) {
    const tags = normalizeTags(req.body.tags);
    if (tags === null) {
      res.status(400).json({ error: "tags must be an array of strings" });
      return;
    }
    updates.tags = tags;
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

  const versionLabel = versionLabelFromHistory(
    drawing.conversationHistory,
    "Auto-save"
  );

  await createVersion(
    drawing._id,
    req.userId!,
    drawing.sceneJson,
    drawing.conversationHistory,
    versionLabel
  );

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
