import { Router } from "express";

const router = Router();

const EMPTY_SCENE = {
  type: "excalidraw",
  version: 2,
  elements: [],
  appState: {},
};

router.post("/", (_req, res) => {
  res.json({ sceneJson: EMPTY_SCENE });
});

export default router;
