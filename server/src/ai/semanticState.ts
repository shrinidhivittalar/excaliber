import type { DiagramPlan } from './layout/types'
import type { ClassificationResult } from './classify'

export const SEMANTIC_STATE_VERSION = 1

export interface EstablishedEntity {
  id:    string   // actual node id in the Excalidraw scene
  label: string   // display label
  role?: string   // semantic role inferred from label + domain
                  // e.g. 'database', 'api-service', 'client', 'load-balancer'
}

export interface DiagramConventions {
  layout:    string | null   // last used layout type
  direction: string | null   // 'LR' | 'TB' | null
  theme:     string          // current theme ('default', 'minimal', 'vibrant')
}

export interface SemanticState {
  version:             number              // SEMANTIC_STATE_VERSION — for safe upgrades
  domain:              string              // from classifier
  diagramType:         string              // from classifier, may change across turns
  establishedEntities: EstablishedEntity[] // all entities drawn and on-canvas
  conventions:         DiagramConventions  // layout/style decisions made
  openThreads:         string[]            // entities mentioned but not yet drawn
  turnCount:           number              // how many AI turns in this conversation
  lastIntent:          string              // last classified intent
}

export function emptySemanticState(): SemanticState {
  return {
    version:             SEMANTIC_STATE_VERSION,
    domain:              'generic',
    diagramType:         '',
    establishedEntities: [],
    conventions: {
      layout:    null,
      direction: null,
      theme:     'default',
    },
    openThreads: [],
    turnCount:   0,
    lastIntent:  'default',
  }
}

// Infer a semantic role from a node label + domain.
// Deliberately simple — covers the common cases without needing an LLM.
function inferRole(label: string, domain: string): string | undefined {
  const l = label.toLowerCase()

  if (/\b(database|db|postgres|mysql|mongo|redis|dynamo)\b/.test(l))
    return 'database'
  if (/\b(api|service|backend|server|endpoint)\b/.test(l))
    return 'api-service'
  if (/\b(client|browser|frontend|mobile|app)\b/.test(l))
    return 'client'
  if (/\b(load.?balancer|gateway|proxy|nginx|cdn)\b/.test(l))
    return 'load-balancer'
  if (/\b(queue|kafka|sqs|pubsub|message)\b/.test(l))
    return 'message-queue'
  if (/\b(cache|memcache)\b/.test(l))
    return 'cache'

  if (domain === 'biology') {
    if (/\b(cell|neuron|organ)\b/.test(l)) return 'biological-unit'
    if (/\b(lobe|cortex|stem)\b/.test(l))  return 'brain-region'
  }

  return undefined
}

// Compare extracted entities against what made it into the plan.
// Anything that was mentioned (in entities[]) but isn't represented
// in any node label goes into openThreads.
function detectOpenThreads(
  extractedEntities: string[],
  plan:              DiagramPlan,
  previous:          string[],
): string[] {
  const coveredLabels = plan.nodes.map(n =>
    `${n.label} ${n.sublabel ?? ''}`.toLowerCase()
  )

  const resolved = new Set(
    previous.filter(thread =>
      coveredLabels.some(l => l.includes(thread.toLowerCase()))
    )
  )

  const newUncovered = extractedEntities.filter(entity =>
    !coveredLabels.some(l => l.includes(entity.toLowerCase()))
  )

  return [
    ...previous.filter(t => !resolved.has(t)),
    ...newUncovered,
  ]
}

// Called after every successful plan_diagram generation.
// Returns the updated state to send back to the client.
export function updateSemanticState(
  previous:       SemanticState,
  classification: ClassificationResult,
  plan:           DiagramPlan,
  theme:          string,
): SemanticState {
  const planNodeIds = new Set(plan.nodes.map(n => n.id))

  const retained = previous.establishedEntities.filter(e => planNodeIds.has(e.id))
  const retainedIds = new Set(retained.map(e => e.id))

  const added: EstablishedEntity[] = plan.nodes
    .filter(n => !retainedIds.has(n.id))
    .map(n => ({
      id:    n.id,
      label: n.label,
      role:  inferRole(n.label, classification.domain),
    }))

  const establishedEntities = [...retained, ...added]

  const openThreads = detectOpenThreads(
    classification.entities,
    plan,
    previous.openThreads,
  )

  return {
    version: SEMANTIC_STATE_VERSION,

    // Prefer the new classifier output unless it's 'generic'/'',
    // in which case keep the previously established value.
    domain:      classification.domain      || previous.domain,
    diagramType: classification.diagramType || previous.diagramType,

    establishedEntities,

    conventions: {
      layout:    plan.layout    ?? previous.conventions.layout,
      direction: plan.direction ?? previous.conventions.direction,
      theme,
    },

    openThreads,
    turnCount:  previous.turnCount + 1,
    lastIntent: classification.intent,
  }
}

// Safely parse a semanticState from untrusted client input.
// Returns emptySemanticState() if anything looks wrong.
export function parseSemanticState(raw: unknown): SemanticState {
  if (!raw || typeof raw !== 'object') return emptySemanticState()

  const obj = raw as Record<string, unknown>

  // Version mismatch: discard stale state and start fresh rather than migrating
  if (typeof obj.version === 'number' && obj.version !== SEMANTIC_STATE_VERSION) {
    return emptySemanticState()
  }

  try {
    return {
      version:     SEMANTIC_STATE_VERSION,
      domain:      typeof obj.domain      === 'string' ? obj.domain      : 'generic',
      diagramType: typeof obj.diagramType === 'string' ? obj.diagramType : '',
      establishedEntities: Array.isArray(obj.establishedEntities)
        ? (obj.establishedEntities as EstablishedEntity[])
        : [],
      conventions: typeof obj.conventions === 'object' && obj.conventions
        ? (obj.conventions as DiagramConventions)
        : { layout: null, direction: null, theme: 'default' },
      openThreads: Array.isArray(obj.openThreads) ? (obj.openThreads as string[]) : [],
      turnCount:   typeof obj.turnCount  === 'number' ? obj.turnCount  : 0,
      lastIntent:  typeof obj.lastIntent === 'string' ? obj.lastIntent : 'default',
    }
  } catch {
    return emptySemanticState()
  }
}
