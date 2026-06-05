import type { DiagramNode, DiagramGroup, DiagramEdge, ComputedNode, ComputedEdge, EdgeStyle } from './types'
import { THEMES, type DiagramTheme, DEFAULT_THEME } from './themes'

export function assignColors(
  nodes:   DiagramNode[],
  groups?: DiagramGroup[],
  theme:   DiagramTheme = DEFAULT_THEME
): Record<string, string> {
  const palette = THEMES[theme].palette
  const colorMap: Record<string, string> = {}

  if (groups && groups.length > 0) {
    groups.forEach((g, i) => {
      colorMap[g.id] = g.color ?? palette[i % palette.length]
    })
  } else {
    nodes.forEach((n, i) => {
      colorMap[n.id] = palette[i % palette.length]
    })
  }
  return colorMap
}

export function buildEdges(edges?: DiagramEdge[]): ComputedEdge[] {
  if (!edges) return []
  return edges.map(e => ({
    fromId: e.from,
    toId: e.to,
    label: e.label,
    style: (e.style ?? 'solid') as EdgeStyle,
    bidirectional: e.bidirectional ?? false,
  }))
}

export function buildGroups(
  groups: DiagramGroup[] | undefined,
  nodes: ComputedNode[]
): { id: string; label: string; x: number; y: number; width: number; height: number; color: string }[] {
  if (!groups || groups.length === 0) return []

  return groups.map(group => {
    const groupNodes = nodes.filter(n => n.groupId === group.id)
    if (groupNodes.length === 0) {
      return { id: group.id, label: group.label, x: 0, y: 0, width: 0, height: 0, color: group.color ?? '#e0e7ff' }
    }

    const xs = groupNodes.map(n => n.x)
    const ys = groupNodes.map(n => n.y)
    const x2s = groupNodes.map(n => n.x + n.width)
    const y2s = groupNodes.map(n => n.y + n.height)

    const x = Math.min(...xs) - 16
    const y = Math.min(...ys) - 16
    const width = Math.max(...x2s) - x + 16
    const height = Math.max(...y2s) - y + 16

    return { id: group.id, label: group.label, x, y, width, height, color: group.color ?? '#e0e7ff' }
  })
}
