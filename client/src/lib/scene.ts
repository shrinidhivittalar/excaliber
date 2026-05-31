import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { AppState } from '@excalidraw/excalidraw/types'

const PSEUDO_ELEMENT_TYPES = new Set([
  'cameraUpdate',
  'delete',
  'restoreCheckpoint',
])

const RUNTIME_APP_STATE_KEYS = [
  'collaborators',
  'followedBy',
  'editingLinearElement',
  'selectedLinearElement',
  'fileHandle',
  'editingTextElement',
  'suggestedBindings',
  'elementsToHighlight',
  'frameToHighlight',
] as const

function isFullExcalidrawElement(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false
  const record = el as Record<string, unknown>
  return typeof record.version === 'number' && record.version >= 1
}

function filterDrawable(elements: unknown[]): unknown[] {
  return elements.filter((el) => {
    if (!el || typeof el !== 'object') return false
    const type = (el as { type?: string }).type
    return type && !PSEUDO_ELEMENT_TYPES.has(type)
  })
}

export function prepareElementsForCanvas(elements: unknown[]): unknown[] {
  const drawable = filterDrawable(Array.isArray(elements) ? elements : [])
  if (drawable.length === 0) return []

  if (drawable.every(isFullExcalidrawElement)) {
    return drawable
  }

  try {
    return convertToExcalidrawElements(
      drawable as ExcalidrawElementSkeleton[],
      { regenerateIds: false }
    )
  } catch (error) {
    console.error('Failed to convert AI elements for canvas:', error)
    return []
  }
}

export function sanitizeAppState(
  appState: AppState | Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!appState || typeof appState !== 'object') {
    return { viewBackgroundColor: '#ffffff' }
  }

  const sanitized = { ...appState } as Record<string, unknown>

  for (const key of RUNTIME_APP_STATE_KEYS) {
    delete sanitized[key]
  }

  return sanitized
}

export function sanitizeScene(scene: object): object {
  const data = scene as {
    elements?: unknown[]
    appState?: Record<string, unknown>
    type?: string
    version?: number
  }

  const rawElements = Array.isArray(data.elements) ? data.elements : []
  const elements = rawElements.every(isFullExcalidrawElement)
    ? rawElements
    : prepareElementsForCanvas(rawElements)

  return {
    type: data.type ?? 'excalidraw',
    version: data.version ?? 2,
    elements,
    appState: sanitizeAppState(data.appState),
  }
}
