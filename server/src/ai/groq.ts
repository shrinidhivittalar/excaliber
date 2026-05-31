import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { callMcpTool, listMcpTools } from "../mcp/client";
import { searchImages } from "../services/images";
import {
  buildSceneFromElements,
  coerceElementsArg,
  extractCheckpointId,
  parseElementsJson,
} from "./scene";
import { SYSTEM_PROMPT } from "./systemPrompt";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ProcessMessageResult {
  reply: string;
  sceneJson: object;
  toolsUsed: string[];
}

const MAX_FUNCTION_ITERATIONS = 10;
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const FETCH_IMAGES_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "fetch_images",
    description:
      "Search for real photos to embed in the drawing. Use for visual/real-world topics.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords for the image",
        },
        count: {
          type: "number",
          description: "Number of images to fetch (1-3)",
        },
      },
      required: ["query"],
    },
  },
};

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function sanitizeSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }

  const obj = { ...(schema as Record<string, unknown>) };
  delete obj.$schema;
  return obj;
}

function mcpToolsToGroqTools(): ChatCompletionTool[] {
  return listMcpTools().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: sanitizeSchema(tool.inputSchema),
    },
  }));
}

function getTools(): ChatCompletionTool[] {
  return [...mcpToolsToGroqTools(), FETCH_IMAGES_TOOL];
}

function historyToMessages(history: Message[]): ChatCompletionMessageParam[] {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

function getElementCount(sceneJson: object): number {
  const scene = sceneJson as { elements?: unknown[] };
  return Array.isArray(scene.elements) ? scene.elements.length : 0;
}

function isExcalidrawScene(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return obj.type === "excalidraw" || Array.isArray(obj.elements);
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractSceneFromValue(
  value: unknown,
  current: object
): object | null {
  if (isExcalidrawScene(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;

  if (obj.sceneJson && isExcalidrawScene(obj.sceneJson)) {
    return obj.sceneJson;
  }
  if (obj.scene && isExcalidrawScene(obj.scene)) {
    return obj.scene;
  }

  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: string }).type === "text" &&
        typeof (item as { text?: string }).text === "string"
      ) {
        const parsed = tryParseJson((item as { text: string }).text);
        const scene = extractSceneFromValue(parsed, current);
        if (scene) {
          return scene;
        }
      }
    }
  }

  if (typeof obj.structuredContent === "object" && obj.structuredContent) {
    return extractSceneFromValue(obj.structuredContent, current);
  }

  return null;
}

async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  sceneJson: object,
  toolsUsed: string[]
): Promise<{ output: unknown; sceneJson: object }> {
  const normalizedArgs =
    toolName === "create_view" ? coerceElementsArg(args) : args;

  console.log("[TOOL]", toolName, normalizedArgs);
  toolsUsed.push(toolName);

  let output: unknown;
  let updatedScene = sceneJson;

  if (toolName === "fetch_images") {
    const query = String(normalizedArgs.query ?? "");
    const count =
      typeof normalizedArgs.count === "number"
        ? Math.min(Math.max(normalizedArgs.count, 1), 3)
        : 3;
    output = await searchImages(query, count);
    const imageResults = Array.isArray(output) ? output : [];
    console.log(
      `[IMAGES] Fetched ${imageResults.length} images for query: ${query}`
    );
  } else {
    output = await callMcpTool(toolName, normalizedArgs);

    if (toolName === "create_view") {
      const elements = parseElementsJson(normalizedArgs.elements);
      if (elements) {
        const checkpoint = extractCheckpointId(output);
        updatedScene = buildSceneFromElements(
          elements,
          updatedScene,
          checkpoint
        );
      }
    }

    const extracted = extractSceneFromValue(output, updatedScene);
    if (extracted) {
      updatedScene = extracted;
    }
  }

  return { output, sceneJson: updatedScene };
}

export async function processMessage(
  userMessage: string,
  history: Message[],
  currentSceneJson: object
): Promise<ProcessMessageResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("AI service error");
  }

  const toolsUsed: string[] = [];
  let sceneJson = currentSceneJson;
  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  try {
    const elementCount = getElementCount(currentSceneJson);
    const checkpointId = (
      currentSceneJson as {
        appState?: { excalidrawMcpCheckpointId?: string };
      }
    ).appState?.excalidrawMcpCheckpointId;

    const checkpointHint = checkpointId
      ? ` Checkpoint ID for restoreCheckpoint: ${checkpointId}.`
      : "";
    const initialPrompt = `${userMessage}\n\nCurrent canvas state: ${elementCount} elements.${checkpointHint}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyToMessages(history),
      { role: "user", content: initialPrompt },
    ];

    const tools = getTools();
    let reply = "";
    let iterations = 0;

    while (iterations < MAX_FUNCTION_ITERATIONS) {
      const response = await getGroq().chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        break;
      }

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls?.length) {
        reply = assistantMessage.content?.trim() ?? "";
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const fn = toolCall.function;
        if (!fn?.name) {
          continue;
        }

        const toolName = fn.name;
        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(fn.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }

        let result: { output: unknown; sceneJson: object };
        try {
          result = await executeToolCall(
            toolName,
            args,
            sceneJson,
            toolsUsed
          );
        } catch (toolError) {
          const message =
            toolError instanceof Error ? toolError.message : "Tool failed";
          console.error("[TOOL ERROR]", toolName, message);
          result = {
            output: { error: message },
            sceneJson,
          };
        }

        sceneJson = result.sceneJson;

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.output),
        });
      }

      iterations += 1;
    }

    return {
      reply: reply || "I've updated the drawing on the canvas.",
      sceneJson: buildSceneFromElements(
        (sceneJson as { elements?: unknown[] }).elements ?? [],
        sceneJson
      ),
      toolsUsed,
    };
  } catch (error) {
    console.error("Groq error:", error);
    throw new Error("AI service error");
  }
}
