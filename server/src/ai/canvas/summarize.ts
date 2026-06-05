export interface CanvasNode {
  id:     string
  label:  string
  shape:  string
  x:      number
  y:      number
  width:  number
  height: number
}

export interface CanvasEdge {
  from:   string
  to:     string
  label?: string
}

export interface CanvasSummary {
  isEmpty:   boolean
  nodeCount: number
  nodes:     CanvasNode[]
  edges:     CanvasEdge[]
}

export function summarizeScene(sceneJson: Record<string, unknown>): CanvasSummary {
  const elements = Array.isArray(sceneJson.elements)
    ? (sceneJson.elements as Record<string, unknown>[])
    : []

  const nodes: CanvasNode[] = elements
    .filter(el =>
      ['rectangle', 'ellipse', 'diamond'].includes(el.type as string) &&
      (el.label as Record<string, unknown>)?.text
    )
    .map(el => ({
      id:     el.id     as string,
      label:  ((el.label as Record<string, unknown>).text ?? '') as string,
      shape:  el.type   as string,
      x:      Math.round(el.x      as number),
      y:      Math.round(el.y      as number),
      width:  Math.round(el.width  as number),
      height: Math.round(el.height as number),
    }))

  const nodeIds = new Set(nodes.map(n => n.id))

  const edges: CanvasEdge[] = elements
    .filter(el =>
      el.type === 'arrow' &&
      (el.startBinding as Record<string, unknown>)?.elementId &&
      (el.endBinding   as Record<string, unknown>)?.elementId
    )
    .map(el => ({
      from:  ((el.startBinding as Record<string, unknown>).elementId) as string,
      to:    ((el.endBinding   as Record<string, unknown>).elementId) as string,
      label: ((el.label as Record<string, unknown>)?.text)            as string | undefined,
    }))
    .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))

  return {
    isEmpty:   nodes.length === 0,
    nodeCount: nodes.length,
    nodes,
    edges,
  }
}

export function formatSummaryForPrompt(summary: CanvasSummary): string {
  if (summary.isEmpty) return 'Canvas is empty.'

  const nodeLines = summary.nodes
    .map(n => `  id:"${n.id}"  label:"${n.label}"  shape:${n.shape}`)
    .join('\n')

  const edgeLines = summary.edges.length
    ? summary.edges
        .map(e => `  "${e.from}" → "${e.to}"${e.label ? `  label:"${e.label}"` : ''}`)
        .join('\n')
    : '  (none)'

  return [
    `Canvas has ${summary.nodeCount} existing node(s):`,
    nodeLines,
    '',
    'Existing connections:',
    edgeLines,
    '',
    'MERGE RULE: to keep a node unchanged use its exact id.',
    'New nodes must have new ids. Omit an edge to remove it.',
    'Set "mode": "merge" in your plan.',
  ].join('\n')
}
