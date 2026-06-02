import crypto from "crypto";

const PSEUDO_ELEMENT_TYPES = new Set([
  "cameraUpdate",
  "delete",
  "restoreCheckpoint",
]);

const LINEAR_TYPES = new Set(["arrow", "line", "draw"]);
const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

const BACKGROUND_PALETTE = [
  "transparent",
  "#dbeafe",
  "#dcfce7",
  "#fef9c3",
  "#fce7f3",
  "#ede9fe",
] as const;

type ElementRecord = Record<string, unknown>;

export function parseElementsJson(elementsArg: unknown): unknown[] | null {
  if (Array.isArray(elementsArg)) {
    return elementsArg;
  }

  if (typeof elementsArg !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(elementsArg);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function toDrawableElements(elements: unknown[]): unknown[] {
  return elements.filter((el) => {
    if (!el || typeof el !== "object") {
      return false;
    }
    const type = (el as { type?: string }).type;
    return type && !PSEUDO_ELEMENT_TYPES.has(type);
  });
}

function normalizeLabel(label: unknown): { text: string; fontSize: number } | undefined {
  if (typeof label === "string") {
    return { text: label, fontSize: 16 };
  }

  if (label && typeof label === "object") {
    const obj = label as { text?: unknown; fontSize?: unknown };
    if (typeof obj.text === "string") {
      return {
        text: obj.text,
        fontSize: typeof obj.fontSize === "number" ? obj.fontSize : 16,
      };
    }
  }

  return undefined;
}

function normalizeElement(el: unknown, index: number): ElementRecord {
  const source = el as ElementRecord;
  const raw = { ...source };
  const type = typeof raw.type === "string" ? raw.type : "rectangle";
  const hadExplicitBackground = source.backgroundColor !== undefined;

  if (!raw.id || typeof raw.id !== "string") {
    raw.id = `el-${index}-${crypto.randomUUID().slice(0, 8)}`;
  }

  raw.type = type;
  raw.x = typeof raw.x === "number" ? raw.x : 0;
  raw.y = typeof raw.y === "number" ? raw.y : 0;

  if (SHAPE_TYPES.has(type)) {
    raw.width = typeof raw.width === "number" ? raw.width : 160;
    raw.height = typeof raw.height === "number" ? raw.height : 70;
  } else {
    raw.width = typeof raw.width === "number" ? raw.width : 120;
    raw.height = typeof raw.height === "number" ? raw.height : 60;
  }

  const label = normalizeLabel(raw.label);
  if (label) {
    raw.label = label;
  } else if (typeof raw.label === "string") {
    delete raw.label;
  }

  if (LINEAR_TYPES.has(type)) {
    const width = raw.width as number;
    const height = raw.height as number;

    if (!Array.isArray(raw.points) || raw.points.length < 2) {
      raw.points = [
        [0, 0],
        [width, height],
      ];
    }

    if (type === "arrow" && raw.endArrowhead === undefined) {
      raw.endArrowhead = "arrow";
    }

    if (raw.strokeWidth === undefined) {
      raw.strokeWidth = 1.5;
    }
    if (raw.roughness === undefined) {
      raw.roughness = 0;
    }
    if (raw.strokeStyle === undefined) {
      raw.strokeStyle = "solid";
    }
  }

  if (type === "text") {
    if (typeof raw.text !== "string") {
      raw.text =
        label?.text ??
        (typeof raw.label === "object"
          ? ((raw.label as { text?: string }).text ?? "Label")
          : "Label");
    }
    if (typeof raw.fontSize !== "number") {
      raw.fontSize = 14;
    }
  }

  if (raw.strokeColor === undefined) {
    raw.strokeColor = "#1e1e1e";
  }

  if (SHAPE_TYPES.has(type)) {
    if (!hadExplicitBackground) {
      raw.backgroundColor = BACKGROUND_PALETTE[index % BACKGROUND_PALETTE.length];
    } else if (raw.backgroundColor === undefined) {
      raw.backgroundColor = "transparent";
    }
    if (raw.strokeWidth === undefined) {
      raw.strokeWidth = 1.5;
    }
  } else if (raw.backgroundColor === undefined) {
    raw.backgroundColor = "transparent";
  }

  if (raw.fillStyle === undefined) {
    raw.fillStyle = "solid";
  }

  if (raw.strokeWidth === undefined) {
    raw.strokeWidth = 2;
  }

  if (raw.opacity === undefined) {
    raw.opacity = 100;
  }

  return raw;
}

export function normalizeDrawableElements(elements: unknown[]): unknown[] {
  return toDrawableElements(elements).map((el, index) =>
    normalizeElement(el, index)
  );
}

export function applyAutoLayout(elements: unknown[]): unknown[] {
  const drawable = elements.filter((el) => {
    const e = el as Record<string, unknown>;
    return e.type && !PSEUDO_ELEMENT_TYPES.has(e.type as string);
  });

  if (drawable.length === 0) return elements;

  const xs = drawable.map(
    (el) =>
      (typeof (el as Record<string, unknown>).x === "number"
        ? ((el as Record<string, unknown>).x as number)
        : 0)
  );
  const xSpread = Math.max(...xs) - Math.min(...xs);

  if (xSpread < 50 && drawable.length > 2) {
    const COLS = 3;
    const CELL_W = 200;
    const CELL_H = 100;
    const GAP_X = 60;
    const GAP_Y = 40;
    const ORIGIN_X = 80;
    const ORIGIN_Y = 80;

    return (elements as Record<string, unknown>[]).map((el) => {
      if (PSEUDO_ELEMENT_TYPES.has(el.type as string)) return el;
      const drawableIndex = drawable.findIndex(
        (d) => (d as Record<string, unknown>).id === el.id
      );
      if (drawableIndex === -1) return el;
      const col = drawableIndex % COLS;
      const row = Math.floor(drawableIndex / COLS);
      return {
        ...el,
        x: ORIGIN_X + col * (CELL_W + GAP_X),
        y: ORIGIN_Y + row * (CELL_H + GAP_Y),
        width: typeof el.width === "number" ? el.width : CELL_W,
        height: typeof el.height === "number" ? el.height : CELL_H,
      };
    });
  }

  return elements;
}

export function buildSceneFromElements(
  elements: unknown[],
  currentScene: object,
  checkpointId?: string
): object {
  const base = currentScene as {
    type?: string;
    version?: number;
    elements?: unknown[];
    appState?: Record<string, unknown>;
  };

  return {
    type: "excalidraw",
    version: 2,
    elements: applyAutoLayout(normalizeDrawableElements(elements)),
    appState: {
      ...(base.appState ?? {}),
      ...(checkpointId ? { excalidrawMcpCheckpointId: checkpointId } : {}),
    },
  };
}

export function extractCheckpointId(output: unknown): string | undefined {
  if (!output || typeof output !== "object") {
    return undefined;
  }

  const obj = output as Record<string, unknown>;

  if (typeof obj.checkpointId === "string") {
    return obj.checkpointId;
  }

  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: string }).type === "text" &&
        typeof (item as { text?: string }).text === "string"
      ) {
        const text = (item as { text: string }).text;
        const match = text.match(/checkpointId["\s:]+([a-zA-Z0-9-]+)/i);
        if (match) {
          return match[1];
        }
        try {
          const parsed = JSON.parse(text) as { checkpointId?: string };
          if (parsed.checkpointId) {
            return parsed.checkpointId;
          }
        } catch {
          // not JSON
        }
      }
    }
  }

  return undefined;
}

export function coerceElementsArg(
  args: Record<string, unknown>
): Record<string, unknown> {
  const elements = args.elements;

  if (elements !== undefined && typeof elements !== "string") {
    return {
      ...args,
      elements: JSON.stringify(elements),
    };
  }

  return args;
}
