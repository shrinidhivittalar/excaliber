import type { DiagramPlan, ComputedLayout } from './types'
import { validateAndFixPlan } from './validation'
import { layoutFlowchart } from './algorithms/flowchart'
import { layoutHierarchy } from './algorithms/hierarchy'
import { layoutCircular } from './algorithms/circular'
import { layoutComparison } from './algorithms/comparison'
import { layoutTimeline } from './algorithms/timeline'
import { layoutMindmap } from './algorithms/mindmap'
import { layoutFreeform } from './algorithms/freeform'
import { computedLayoutToExcalidraw } from './converter'
import { DEFAULT_THEME } from './themes'

export class LayoutError extends Error {
  constructor(
    public readonly stage: 'validation' | 'layout' | 'serialization',
    message: string,
    public readonly detail?: string
  ) {
    super(message)
    this.name = 'LayoutError'
  }
}

type StoredPosition = { x: number; y: number; width: number; height: number }

function extractExistingPositions(elements: unknown[]): Map<string, StoredPosition> {
  const map = new Map<string, StoredPosition>()
  for (const el of elements as Record<string, unknown>[]) {
    if (
      typeof el.id     === 'string' &&
      typeof el.x      === 'number' &&
      typeof el.y      === 'number' &&
      el.type !== 'arrow' &&
      el.type !== 'text'
    ) {
      map.set(el.id, {
        x:      el.x      as number,
        y:      el.y      as number,
        width:  (el.width  as number) || 170,
        height: (el.height as number) || 70,
      })
    }
  }
  return map
}

type ExistingPositions = Map<string, StoredPosition>

function runLayout(plan: DiagramPlan, existingPositions: ExistingPositions): ComputedLayout {
  switch (plan.layout) {
    case 'flowchart':  return layoutFlowchart(plan, existingPositions)
    case 'hierarchy':  return layoutHierarchy(plan, existingPositions)
    case 'circular':   return layoutCircular(plan)
    case 'comparison': return layoutComparison(plan)
    case 'timeline':   return layoutTimeline(plan)
    case 'mindmap':    return layoutMindmap(plan)
    case 'freeform':
    default:           return layoutFreeform(plan, existingPositions)
  }
}

export function planToExcalidrawElements(
  plan: DiagramPlan,
  existingElements?: unknown[]
): unknown[] {
  // Stage 1: validation
  let fixed: DiagramPlan
  try {
    const result = validateAndFixPlan(plan)
    if (result.warnings.length > 0) console.warn('[LAYOUT VALIDATION]', result.warnings)
    if (!result.valid) {
      throw new LayoutError('validation', result.errors.join(', '), result.errors.join(', '))
    }
    fixed = result.fixed!
  } catch (e) {
    if (e instanceof LayoutError) throw e
    throw new LayoutError('validation', 'Validation failed', e instanceof Error ? e.message : String(e))
  }

  // Extract existing positions for merge mode
  const existingPositions: ExistingPositions =
    (fixed.mode === 'merge' && existingElements)
      ? extractExistingPositions(existingElements)
      : new Map()

  // Stage 2: layout algorithm
  let layout: ComputedLayout
  try {
    layout = runLayout(fixed, existingPositions)
  } catch (e) {
    throw new LayoutError(
      'layout',
      `Layout algorithm failed for "${fixed.layout}"`,
      e instanceof Error ? e.message : String(e)
    )
  }

  // Stage 3: serialization via converter (uses routed edges)
  try {
    const cameraUpdate = { type: 'cameraUpdate', fitToContent: true }
    return [cameraUpdate, ...computedLayoutToExcalidraw(layout, fixed.theme ?? DEFAULT_THEME)]
  } catch (e) {
    throw new LayoutError(
      'serialization',
      'Failed to convert layout to Excalidraw elements',
      e instanceof Error ? e.message : String(e)
    )
  }
}
