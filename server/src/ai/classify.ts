import Groq from 'groq-sdk'
import { logger } from '../lib/logger'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export type DiagramIntent =
  | 'show_me' | 'wireframe' | 'system_design' | 'annotate' | 'refine' | 'default'

export type LayoutHint =
  | 'flowchart' | 'hierarchy' | 'circular' | 'comparison'
  | 'timeline' | 'mindmap' | 'freeform'

export interface ClassificationResult {
  intent:             DiagramIntent
  layoutHint:         LayoutHint
  needsImages:        boolean
  entities:           string[]
  ambiguous:          boolean
  clarifyingQuestion?: string
  domain:             string   // e.g. 'networking', 'software/backend', 'biology', 'generic'
  diagramType:        string   // e.g. 'tcp-handshake', 'merge-sort-algorithm', ''
}

const CLASSIFY_PROMPT = `You classify a diagram request. Respond with ONLY a JSON object, no markdown.

intent — pick exactly one:
  show_me        "show me X", "what does X look like", "picture of X" (X is a real-world subject)
  wireframe      "wireframe", "sketch", "mockup", "lo-fi", "rough layout"
  system_design  "system design", "architecture of", "infrastructure for", "tech stack for"
  annotate       "annotate", "add labels to", "label this", "explain this" (canvas already has content)
  refine         "refine", "clean up", "improve", "fix this", "redo" (canvas already has content)
  default        anything else

layoutHint — pick exactly one, based on what's being asked for:
  flowchart   step-by-step processes, "how X works", pipelines
  hierarchy   trees, org charts, parent-child, code structure
  circular    cycles, life cycles, recurring processes
  comparison  "X vs Y", pros/cons, side-by-side
  timeline    history, roadmaps, events over time
  mindmap     brainstorms, concept maps, central-idea-with-branches
  freeform    annotated images, anatomy, anything that doesn't fit above

needsImages — true ONLY for physical/biological/geographic/real-world visual
  subjects (organs, animals, plants, landmarks, space, people, objects).
  False for flowcharts, code, abstract concepts, math, system design.

entities — list every concrete named thing the user wants represented.
  "visualize brain" -> ["cerebrum","cerebellum","brainstem"] (the parts of a
  brain, since a complete brain diagram requires naming them, even though
  the user only said "brain"). "show GET POST PUT" -> ["GET","POST","PUT"].
  If the user names a general topic with no enumerable sub-parts, return
  just that topic as a single-item array.

domain — pick the closest match or use 'generic':
  networking        TCP, HTTP, DNS, WebSocket, protocols
  software/backend  APIs, microservices, databases, caches, queues
  software/frontend UI, components, React, state management, wireframes
  biology           cells, organs, anatomy, life cycles, genetics
  history           events, timelines, civilisations, dates
  mathematics       algorithms, data structures, proofs, graphs
  business          org charts, workflows, processes, strategy
  generic           anything that doesn't fit the above

diagramType — a short slug describing what's being drawn, derived from the
  user's request. Examples:
    "show TCP handshake"        → "tcp-handshake"
    "system design for Twitter" → "twitter-system-design"
    "visualize the brain"       → "brain-anatomy"
    "draw merge sort"           → "merge-sort-algorithm"
    "compare REST vs GraphQL"   → "rest-vs-graphql"
  If the request is too vague to name, use empty string "".

ambiguous — true ONLY if you genuinely cannot tell what to draw (e.g. "make
  it better" with no other context). If true, also set clarifyingQuestion
  to ONE short question. Otherwise false and omit clarifyingQuestion.

Respond with exactly: {"intent":"...","layoutHint":"...","needsImages":bool,"entities":[...],"ambiguous":bool,"domain":"...","diagramType":"..."}`

export async function classifyRequest(
  userMessage:   string,
  canvasIsEmpty: boolean,
  requestId?:    string,
): Promise<ClassificationResult> {
  try {
    const response = await groq.chat.completions.create({
      model:           'llama-3.1-8b-instant',
      temperature:     0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLASSIFY_PROMPT },
        {
          role: 'user',
          content: `Canvas is currently ${canvasIsEmpty ? 'empty' : 'non-empty (has existing content)'}.\nRequest: ${userMessage}`,
        },
      ],
    })

    const raw    = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as Partial<ClassificationResult>

    const result: ClassificationResult = {
      intent:             parsed.intent      ?? 'default',
      layoutHint:         parsed.layoutHint  ?? 'freeform',
      needsImages:        parsed.needsImages ?? false,
      entities:           Array.isArray(parsed.entities) ? parsed.entities : [],
      ambiguous:          parsed.ambiguous   ?? false,
      clarifyingQuestion: parsed.clarifyingQuestion,
      domain:             typeof parsed.domain      === 'string' ? parsed.domain      : 'generic',
      diagramType:        typeof parsed.diagramType === 'string' ? parsed.diagramType : '',
    }

    // annotate/refine only make sense on a non-empty canvas
    if ((result.intent === 'annotate' || result.intent === 'refine') && canvasIsEmpty) {
      result.intent = 'default'
    }

    logger.info('classify_result', { requestId, ...result })
    return result
  } catch (err) {
    logger.warn('classify_failed', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    })
    return {
      intent: 'default', layoutHint: 'freeform', needsImages: false,
      entities: [], ambiguous: false, domain: 'generic', diagramType: '',
    }
  }
}
