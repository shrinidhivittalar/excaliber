import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions'

export const PLAN_DIAGRAM_TOOL: ChatCompletionTool = {
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
              id:       { type: 'string' },
              label:    { type: 'string' },
              shape:    { type: 'string', enum: ['rectangle', 'ellipse', 'diamond', 'text'] },
              size:     { type: 'string', enum: ['xs', 'sm', 'md', 'lg', 'xl'] },
              group:    { type: 'string' },
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
              from:          { type: 'string' },
              to:            { type: 'string' },
              label:         { type: 'string' },
              style:         { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
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
              id:    { type: 'string' },
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
