import type { ComputedNode, ComputedEdge, ComputedLayout } from './types'
import { routeEdge } from './edge-router'
import { THEMES, type DiagramTheme, DEFAULT_THEME, type ThemeConfig } from './themes'

let _uidCounter = 0
function uid(prefix: string): string {
  return `${prefix}_${(++_uidCounter).toString(36)}`
}

function shapeToExcalidrawType(shape: string): string {
  switch (shape) {
    case 'ellipse':  return 'ellipse'
    case 'diamond':  return 'diamond'
    case 'text':     return 'text'
    default:         return 'rectangle'
  }
}

function shapeToExcalidraw(node: ComputedNode, theme: ThemeConfig): object {
  return {
    id: node.id,
    type: shapeToExcalidrawType(node.shape),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    strokeColor: theme.strokeColor,
    backgroundColor: node.backgroundColor,
    fillStyle: 'solid',
    strokeWidth: theme.strokeWidth,
    roughness: 1,
    opacity: 100,
    label: {
      text: node.sublabel ? `${node.label}\n${node.sublabel}` : node.label,
      fontSize: node.fontSize,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
  }
}

function edgeToExcalidraw(
  edge: ComputedEdge,
  nodeMap: Map<string, ComputedNode>,
  theme: ThemeConfig
): object | null {
  const from = nodeMap.get(edge.fromId)
  const to   = nodeMap.get(edge.toId)
  if (!from || !to) return null

  const routePoints = routeEdge(from, to, Array.from(nodeMap.values()))
  const origin = routePoints[0]

  const allX = routePoints.map(p => p.x - origin.x)
  const allY = routePoints.map(p => p.y - origin.y)

  const arrow: Record<string, unknown> = {
    id: uid('arrow'),
    type: 'arrow',
    x: origin.x,
    y: origin.y,
    width:  Math.max(1, Math.max(...allX) - Math.min(...allX)),
    height: Math.max(1, Math.max(...allY) - Math.min(...allY)),
    points: routePoints.map(p => [p.x - origin.x, p.y - origin.y]),
    strokeColor: theme.arrowColor,
    backgroundColor: 'transparent',
    strokeWidth: theme.arrowStrokeWidth,
    roughness: 0,
    opacity: 100,
    endArrowhead: 'arrow',
    startArrowhead: edge.bidirectional ? 'arrow' : null,
    strokeStyle:
      edge.style === 'dashed'  ? 'dashed'  :
      edge.style === 'dotted'  ? 'dotted'  : 'solid',
  }

  if (edge.label) {
    arrow.label = { text: edge.label, fontSize: 12 }
  }

  return arrow
  // NOTE: startBinding/endBinding intentionally omitted.
  // Excalidraw overrides explicit points when bindings are set, defeating
  // the routed path. Arrows won't snap on manual drag — acceptable trade-off.
}

function groupContainerToExcalidraw(
  group: ComputedLayout['groups'][number],
  theme: ThemeConfig
): object {
  const hexAlpha = Math.round(theme.groupOpacity * 2.55).toString(16).padStart(2, '0')
  return {
    type: 'rectangle',
    id: `group_bg_${group.id}`,
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
    strokeColor: group.color,
    backgroundColor: group.color + hexAlpha,
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    label: {
      text: group.label,
      fontSize: 11,
      textAlign: 'left',
      verticalAlign: 'top',
    },
  }
}

export function computedLayoutToExcalidraw(
  layout: ComputedLayout,
  theme: DiagramTheme = DEFAULT_THEME
): unknown[] {
  const nodeMap = new Map(layout.nodes.map(n => [n.id, n]))
  const t = THEMES[theme]

  const elements: unknown[] = []

  layout.groups
    .filter(g => g.width > 0 && g.height > 0)
    .forEach(g => elements.push(groupContainerToExcalidraw(g, t)))

  layout.nodes.forEach(n => elements.push(shapeToExcalidraw(n, t)))

  layout.edges.forEach(e => {
    const arrow = edgeToExcalidraw(e, nodeMap, t)
    if (arrow) elements.push(arrow)
  })

  return elements
}
