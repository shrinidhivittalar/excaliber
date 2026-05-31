import fs from "fs";
import path from "path";

const VENDOR_ENTRY = path.join(
  __dirname,
  "..",
  "..",
  "vendor",
  "excalidraw-mcp",
  "dist",
  "index.js"
);

export function resolveExcalidrawMcpEntry(): string | null {
  if (process.env.EXCALIDRAW_MCP_PATH) {
    return process.env.EXCALIDRAW_MCP_PATH;
  }

  if (fs.existsSync(VENDOR_ENTRY)) {
    return VENDOR_ENTRY;
  }

  return null;
}
