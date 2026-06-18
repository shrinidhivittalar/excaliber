export interface EvalCase {
  name:             string
  prompt:           string
  canvasIsEmpty:    boolean
  expectIntent?:    string
  expectTool?:      string
  minNodes?:        number
  maxNodes?:        number
  expectEntities?:  string[]
  expectGroupIds?:  string[]
}

export const EVAL_CASES: EvalCase[] = [
  // ── Show-me ──────────────────────────────────────────────────────────
  {
    name: 'show_me_heart', prompt: 'show me a human heart', canvasIsEmpty: true,
    expectIntent: 'show_me', expectTool: 'fetch_images', minNodes: 3,
  },
  {
    name: 'show_me_earth_layers', prompt: 'show the layers of the earth', canvasIsEmpty: true,
    expectIntent: 'show_me',
    expectEntities: ['crust', 'mantle', 'core'],
  },

  // ── Wireframe ─────────────────────────────────────────────────────────
  {
    name: 'wireframe_login', prompt: 'wireframe a login screen', canvasIsEmpty: true,
    expectIntent: 'wireframe', minNodes: 2, maxNodes: 8,
  },
  {
    name: 'wireframe_dashboard', prompt: 'wireframe a dashboard layout', canvasIsEmpty: true,
    expectIntent: 'wireframe', minNodes: 3, maxNodes: 10,
  },

  // ── System design ────────────────────────────────────────────────────
  {
    name: 'system_design_twitter', prompt: 'system design for twitter', canvasIsEmpty: true,
    expectIntent: 'system_design',
    expectGroupIds: ['client', 'gateway', 'services', 'data'],
  },
  {
    name: 'system_design_delivery', prompt: 'system design for a food delivery app', canvasIsEmpty: true,
    expectIntent: 'system_design', minNodes: 5,
  },

  // ── Completeness (multi-entity) ───────────────────────────────────────
  {
    name: 'brain_completeness', prompt: 'visualize the brain', canvasIsEmpty: true,
    expectEntities: ['cerebrum', 'cerebellum', 'brainstem'],
  },
  {
    name: 'http_methods', prompt: 'show HTTP methods GET POST PUT DELETE PATCH', canvasIsEmpty: true,
    expectEntities: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
  {
    name: 'osi_layers', prompt: 'draw the 7 OSI model layers', canvasIsEmpty: true,
    minNodes: 7,
  },

  // ── Layout variety ───────────────────────────────────────────────────
  {
    name: 'flowchart_tcp', prompt: 'how does a TCP handshake work', canvasIsEmpty: true,
    minNodes: 3,
  },
  {
    name: 'timeline_web', prompt: 'history of the world wide web', canvasIsEmpty: true,
    expectIntent: 'default', minNodes: 4,
  },
  {
    name: 'comparison_sql_nosql', prompt: 'SQL vs NoSQL comparison', canvasIsEmpty: true,
    minNodes: 2,
  },
  {
    name: 'mindmap_react', prompt: 'concept map of React', canvasIsEmpty: true,
    minNodes: 5,
  },

  // ── Canvas-aware intents ─────────────────────────────────────────────
  {
    name: 'refine_existing', prompt: 'clean this up', canvasIsEmpty: false,
    expectIntent: 'refine',
  },
  {
    name: 'annotate_existing', prompt: 'annotate the existing diagram', canvasIsEmpty: false,
    expectIntent: 'annotate',
  },

  // ── Edge cases ───────────────────────────────────────────────────────
  {
    name: 'non_visual', prompt: 'explain how bubble sort works step by step', canvasIsEmpty: true,
    expectIntent: 'default', minNodes: 3,
  },
  {
    name: 'flowchart_login_steps', prompt: 'flowchart for user login and authentication', canvasIsEmpty: true,
    minNodes: 3,
  },
]
