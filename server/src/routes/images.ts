import { Router } from "express";
import { z } from "zod";
import { searchImages } from "../services/images";

const router = Router();

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(10).optional().default(3),
});

router.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  if (!process.env.PEXELS_API_KEY) {
    res.json({ images: [], error: "Image search not configured" });
    return;
  }

  const { q, limit } = parsed.data;
  const images = await searchImages(q, limit);
  res.json({ images });
});

export default router;
