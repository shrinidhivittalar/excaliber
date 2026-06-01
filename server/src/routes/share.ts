import { Router } from "express";
import { Drawing } from "../models/Drawing";

const router = Router();

router.get("/:shareId", async (req, res) => {
  const shareId = Array.isArray(req.params.shareId)
    ? req.params.shareId[0]
    : req.params.shareId;

  const drawing = await Drawing.findOne({ shareId, isPublic: true })
    .select("title sceneJson")
    .lean();

  if (!drawing) {
    res.status(404).json({ error: "Shared drawing not found" });
    return;
  }

  res.json({ title: drawing.title, sceneJson: drawing.sceneJson });
});

export default router;
