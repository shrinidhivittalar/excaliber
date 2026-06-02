import mongoose from "mongoose";
import { DrawingVersion } from "../models/DrawingVersion";

const MAX_VERSIONS = 20;

function getElementCount(sceneJson: unknown): number {
  const scene = sceneJson as { elements?: unknown[] };
  return Array.isArray(scene.elements) ? scene.elements.length : 0;
}

export async function createVersion(
  drawingId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  sceneJson: unknown,
  conversationHistory: unknown[],
  label: string
) {
  const latest = await DrawingVersion.findOne({ drawingId })
    .sort({ versionNumber: -1 })
    .select("versionNumber")
    .lean();

  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const version = await DrawingVersion.create({
    drawingId,
    userId,
    versionNumber,
    label,
    sceneJson,
    conversationHistory,
    elementCount: getElementCount(sceneJson),
  });

  const count = await DrawingVersion.countDocuments({ drawingId });
  if (count > MAX_VERSIONS) {
    const oldest = await DrawingVersion.findOne({ drawingId })
      .sort({ versionNumber: 1 })
      .select("_id")
      .lean();
    if (oldest) {
      await DrawingVersion.deleteOne({ _id: oldest._id });
    }
  }

  return version;
}
