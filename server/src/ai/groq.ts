import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { callMcpTool, listMcpTools } from "../mcp/client";
import { searchImages } from "../services/images";
import { logger } from "../lib/logger";
import { withRetry, withTimeout } from "../lib/retry";
import {
  buildSceneFromElements,
  coerceElementsArg,
  extractCheckpointId,
  parseElementsJson,
} from "./scene";
import { SYSTEM_PROMPT, INGEST_PROMPT } from "./systemPrompt";
import { planToExcalidrawElements, LayoutError } from "./layout";
import type { DiagramPlan } from "./layout/types";
import type { DiagramTheme } from "./layout/themes";
import { summarizeScene, formatSummaryForPrompt } from "./canvas/summarize";
import { recordUsage } from "../services/tokenBudget";
import { trimHistory } from "./history";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ProcessMessageResult {
  reply: string;
  sceneJson: object;
  toolsUsed: string[];
  stages: string[];
  mermaidDiagram?: string;
}

const MAX_FUNCTION_ITERATIONS = 10;
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const PLAN_DIAGRAM_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'plan_diagram',
    description: 'Plan a diagram semantically. Server handles all layout and positioning.',
    parameters: {
      type: 'object',
      properties: {
        layout: {
          type: 'string',
          enum: ['flowchart', 'hierarchy', 'circular', 'comparison', 'timeline', 'mindmap', 'freeform'],
          description: 'Layout algorithm to use',
        },
        title: { type: 'string', description: 'Optional diagram title' },
        nodes: {
          type: 'array',
          description: 'All entities to draw. MUST include every mentioned entity.',
          items: {
            type: 'object',
            required: ['id', 'label', 'shape'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              shape: { type: 'string', enum: ['rectangle', 'ellipse', 'diamond', 'text'] },
              size: { type: 'string', enum: ['xs', 'sm', 'md', 'lg', 'xl'] },
              group: { type: 'string' },
              sublabel: { type: 'string' },
              emphasis: { type: 'boolean' },
            },
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              label: { type: 'string' },
              style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
              bidirectional: { type: 'boolean' },
            },
          },
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'label'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              color: { type: 'string' },
            },
          },
        },
        direction: { type: 'string', enum: ['LR', 'TB'] },
        mode: {
          type: 'string',
          enum: ['replace', 'merge'],
          description:
            '"merge" when the canvas already has nodes and the user wants to add or change something. ' +
            '"replace" for a fresh drawing (default).',
        },
      },
      required: ['layout', 'nodes'],
    },
  },
}

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
  return [...mcpToolsToGroqTools(), FETCH_IMAGES_TOOL, PLAN_DIAGRAM_TOOL];
}

function getIngestTools(): ChatCompletionTool[] {
  return [...mcpToolsToGroqTools(), PLAN_DIAGRAM_TOOL];
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
  toolsUsed: string[],
  stages: string[],
  theme: DiagramTheme,
  requestId?: string,
  userId?: string,
): Promise<{ output: unknown; sceneJson: object }> {
  const normalizedArgs =
    toolName === "create_view" ? coerceElementsArg(args) : args;

  logger.info('tool_call', { requestId, toolName, userId });

  let output: unknown;
  let updatedScene = sceneJson;

  if (toolName === "plan_diagram") {
    const plan = normalizedArgs as unknown as DiagramPlan

    if (!plan.nodes || plan.nodes.length === 0) {
      output = { error: 'plan_diagram requires at least one node' }
      return { output, sceneJson: updatedScene }
    }

    logger.info('plan_diagram', { requestId, userId, layout: plan.layout, nodeCount: plan.nodes.length })
    toolsUsed.push('plan_diagram')
    stages.push(
      `Planning ${plan.layout} diagram — ${plan.nodes.length} node${plan.nodes.length !== 1 ? 's' : ''}...`
    )
    if ((plan.edges?.length ?? 0) > 0) {
      stages.push(`Routing ${plan.edges!.length} connection${plan.edges!.length !== 1 ? 's' : ''}...`)
    }

    try {
      const currentElements =
        (sceneJson as Record<string, unknown>).elements as unknown[] | undefined
      const planWithTheme: DiagramPlan = { ...plan, theme }
      const elements = planToExcalidrawElements(planWithTheme, currentElements)
      logger.info('plan_diagram_elements', { requestId, userId, nodeCount: elements.length })

      const elementsJson = JSON.stringify(elements)
      const mcpResult = await callMcpTool('create_view', { elements: elementsJson })
      output = mcpResult
      toolsUsed.push('create_view')

      const checkpoint = extractCheckpointId(mcpResult)
      updatedScene = buildSceneFromElements(
        (elements as unknown[]).filter((el: unknown) => (el as { type?: string }).type !== 'cameraUpdate'),
        updatedScene,
        checkpoint
      )
    } catch (planError) {
      const isLayoutError = planError instanceof LayoutError
      const stage = isLayoutError ? planError.stage : 'unknown'
      const detail = isLayoutError
        ? (planError.detail ?? planError.message)
        : planError instanceof Error ? planError.message : 'Unexpected error'

      logger.error('plan_diagram_error', {
        requestId,
        userId,
        message: detail,
        layout: plan.layout,
        nodeCount: plan.nodes?.length ?? 0,
        stage,
      })

      const hints: Record<string, string> = {
        validation: 'The plan structure was invalid. Simplify the diagram or reduce the number of nodes.',
        layout: 'The layout algorithm failed. Try a different layout type or fewer nodes.',
        serialization: 'The drawing could not be rendered. Try rephrasing your request.',
        unknown: 'An unexpected error occurred. Try rephrasing your request.',
      }

      output = {
        error: 'plan_diagram failed',
        stage,
        detail,
        planSummary: { layout: plan.layout, nodeCount: plan.nodes?.length ?? 0 },
        hint: hints[stage] ?? hints.unknown,
      }
    }

    return { output, sceneJson: updatedScene }
  }

  toolsUsed.push(toolName);

  if (toolName === "fetch_images") {
    const query = String(normalizedArgs.query ?? "");
    const count =
      typeof normalizedArgs.count === "number"
        ? Math.min(Math.max(normalizedArgs.count, 1), 3)
        : 3;
    output = await searchImages(query, count);
    const imageResults = Array.isArray(output) ? output : [];
    logger.info('images_fetched', { requestId, userId, count: imageResults.length, query });
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

interface ToolLoopResult {
  reply: string
  sceneJson: object
  totalInputTokens: number
  totalOutputTokens: number
}

async function runToolLoop(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  initialScene: object,
  toolsUsed: string[],
  stages: string[],
  theme: DiagramTheme,
  model: string,
  requestId?: string,
  userId?: string,
): Promise<ToolLoopResult> {
  let reply = ''
  let iterations = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let sceneJson = initialScene

  while (iterations < MAX_FUNCTION_ITERATIONS) {
    const response = await withRetry(
      () => withTimeout(
        () => getGroq().chat.completions.create({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
        }),
        25_000,
        'groq_completion'
      ),
      {
        maxAttempts: 3,
        baseDelayMs: 1_000,
        shouldRetry: (err) => {
          if (err instanceof Error) {
            const msg = err.message.toLowerCase()
            return msg.includes('rate') || msg.includes('timeout') || msg.includes('503')
          }
          return false
        },
      }
    )

    if (response.usage) {
      totalInputTokens  += response.usage.prompt_tokens
      totalOutputTokens += response.usage.completion_tokens
    }

    const assistantMessage = response.choices[0]?.message
    if (!assistantMessage) break

    const toolCalls = assistantMessage.tool_calls
    if (!toolCalls?.length) {
      reply = assistantMessage.content?.trim() ?? ''
      break
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: toolCalls,
    })

    for (const toolCall of toolCalls) {
      const fn = toolCall.function
      if (!fn?.name) continue

      const toolName = fn.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(fn.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }

      let result: { output: unknown; sceneJson: object }
      try {
        result = await executeToolCall(toolName, args, sceneJson, toolsUsed, stages, theme, requestId, userId)
      } catch (toolError) {
        const message = toolError instanceof Error ? toolError.message : 'Tool failed'
        logger.error('tool_error', { requestId, userId, toolName, message })
        result = { output: { error: message }, sceneJson }
      }

      sceneJson = result.sceneJson

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.output),
      })
    }

    iterations += 1
  }

  return { reply, sceneJson, totalInputTokens, totalOutputTokens }
}

export async function processMessage(
  userMessage: string,
  history: Message[],
  currentSceneJson: object,
  theme: DiagramTheme = 'default',
  requestId?: string,
  userId?: string,
): Promise<ProcessMessageResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("AI service error");
  }

  const toolsUsed: string[] = [];
  const stages: string[] = []
  stages.push('Reading your request...')
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

    const canvasSummary = summarizeScene(currentSceneJson as Record<string, unknown>)
    const contextBlock  = formatSummaryForPrompt(canvasSummary)

    const enrichedUserMessage = canvasSummary.isEmpty
      ? userMessage
      : `${userMessage}\n\n[CURRENT CANVAS]\n${contextBlock}`

    const initialPrompt = `${enrichedUserMessage}\n\nCurrent canvas state: ${elementCount} elements.${checkpointHint}`;

    const trimmedHistory = trimHistory(history)
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyToMessages(trimmedHistory),
      { role: "user", content: initialPrompt },
    ];

    const tools = getTools();

    const loopResult = await runToolLoop(
      messages, tools, sceneJson, toolsUsed, stages, theme, model, requestId, userId,
    )
    const { reply, totalInputTokens, totalOutputTokens } = loopResult
    sceneJson = loopResult.sceneJson

    stages.push('Placing on canvas...')

    const totalTokens = totalInputTokens + totalOutputTokens
    if (totalTokens > 0) {
      logger.info('groq_tokens', {
        requestId,
        userId,
        inputTokens:  totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
      })
      if (userId) recordUsage(userId, totalTokens)
    }

    const mermaidMatch = reply.match(/```mermaid\n([\s\S]+?)\n```/);
    if (mermaidMatch) {
      const mermaidCode = mermaidMatch[1];
      return {
        reply:
          reply.replace(/```mermaid[\s\S]+?```/, "").trim() ||
          "Here is the diagram.",
        sceneJson: buildSceneFromElements(
          (sceneJson as { elements?: unknown[] }).elements ?? [],
          sceneJson
        ),
        toolsUsed,
        stages,
        mermaidDiagram: mermaidCode,
      };
    }

    return {
      reply: reply || "I've updated the drawing on the canvas.",
      sceneJson: buildSceneFromElements(
        (sceneJson as { elements?: unknown[] }).elements ?? [],
        sceneJson
      ),
      toolsUsed,
      stages,
    };
  } catch (error) {
    logger.error('groq_error', {
      requestId,
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("AI service error");
  }
}

export async function processIngest(
  content: string,
  filename?: string,
  requestId?: string,
  userId?: string,
): Promise<ProcessMessageResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI service error')
  }

  const stages: string[] = []
  const toolsUsed: string[] = []
  stages.push('Reading document...')

  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL
  const ext = filename?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  const typeHint = ext ? `File type: .${ext}\n` : ''

  const userMessage = [
    typeHint,
    'Analyse the content below and call plan_diagram to create a diagram that best represents its structure:\n\n',
    '<document>\n',
    content.slice(0, 10_000),
    '\n</document>',
  ].join('')

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: INGEST_PROMPT },
    { role: 'user', content: userMessage },
  ]

  stages.push('Analysing structure...')

  const tools = getIngestTools()

  try {
    const loopResult = await runToolLoop(
      messages, tools, {}, toolsUsed, stages, 'default', model, requestId, userId,
    )
    const { reply, totalInputTokens, totalOutputTokens } = loopResult
    const sceneJson = loopResult.sceneJson

    stages.push('Placing on canvas...')

    const totalTokens = totalInputTokens + totalOutputTokens
    if (totalTokens > 0) {
      logger.info('groq_tokens', {
        requestId,
        userId,
        inputTokens:  totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
      })
      if (userId) recordUsage(userId, totalTokens)
    }

    return {
      reply: reply || 'Here is a diagram based on your content.',
      sceneJson: buildSceneFromElements(
        (sceneJson as { elements?: unknown[] }).elements ?? [],
        sceneJson,
      ),
      toolsUsed,
      stages,
    }
  } catch (error) {
    logger.error('ingest_error', {
      requestId,
      userId,
      message: error instanceof Error ? error.message : String(error),
    })
    throw new Error('AI service error')
  }
}
