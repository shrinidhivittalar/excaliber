import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { resolveExcalidrawMcpEntry } from "./resolvePath";
import { logger } from "../lib/logger";

export let isMcpAvailable = false;
export let mcpClient: Client | null = null;

let cachedTools: Tool[] = [];

export function listMcpTools(): Tool[] {
  return cachedTools;
}

export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!mcpClient || !isMcpAvailable) {
    throw new Error("MCP client is not available");
  }

  return mcpClient.callTool({
    name: toolName,
    arguments: args,
  });
}

export async function initMcp(): Promise<void> {
  const mcpEntry = resolveExcalidrawMcpEntry();
  if (!mcpEntry) {
    isMcpAvailable = false;
    logger.warn("mcp_missing", {
      message: "Excalidraw MCP not built. Run: npm run setup:mcp --workspace=server",
    });
    return;
  }

  const client = new Client(
    { name: "excaliber-server", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntry, "--stdio"],
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    mcpClient = client;
    cachedTools = tools;
    isMcpAvailable = true;
    logger.info("mcp_connected", { tools: tools.map((t) => t.name) });
  } catch (error) {
    isMcpAvailable = false;
    mcpClient = null;
    cachedTools = [];
    logger.warn("mcp_connection_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}


