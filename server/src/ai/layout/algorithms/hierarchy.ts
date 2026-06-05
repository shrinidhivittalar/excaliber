import type { DiagramPlan, ComputedNode, ComputedLayout } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

const LEVEL_GAP = 120
const SIBLING_GAP = 40
const MARGIN = 80

type ExistingPositions = Map<string, { x: number; y: number; width: number; height: number }>

export function layoutHierarchy(
  plan: DiagramPlan,
  existingPositions: ExistingPositions = new Map()
): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups, plan.theme)
  const edges = plan.edges ?? []

  // Build parent-child map from edges
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  plan.nodes.forEach(n => children.set(n.id, []))
  edges.forEach(e => {
    children.get(e.from)?.push(e.to)
    hasParent.add(e.to)
  })

  // Find root nodes (no parent)
  const roots = plan.nodes
    .filter(n => !hasParent.has(n.id))
    .map(n => n.id)

  if (roots.length === 0) roots.push(plan.nodes[0]?.id ?? '')

  // BFS to assign levels
  const levels = new Map<string, number>()
  const queue = [...roots]
  roots.forEach(r => levels.set(r, 0))
  while (queue.length > 0) {
    const current = queue.shift()!
    const level = levels.get(current) ?? 0
    ;(children.get(current) ?? []).forEach(child => {
      if (!levels.has(child)) {
        levels.set(child, level + 1)
        queue.push(child)
      }
    })
  }

  // Group nodes by level
  const byLevel = new Map<number, string[]>()
  levels.forEach((level, id) => {
    if (!byLevel.has(level)) byLevel.set(level, [])
    byLevel.get(level)!.push(id)
  })

  const nodeMap = new Map(plan.nodes.map(n => [n.id, n]))
  const computed = new Map<string, ComputedNode>()

  // Calculate dimensions per node
  const dims = new Map<string, { w: number; h: number; fontSize: number }>()
  plan.nodes.forEach(n => {
    const { width, height, fontSize } = computeNodeDimensions(n.label, n.size, n.shape)
    dims.set(n.id, { w: width, h: height, fontSize })
  })

  // Merge mode: pin existing nodes to their stored positions first
  levels.forEach((_level, id) => {
    if (existingPositions.has(id)) {
      const pos = existingPositions.get(id)!
      const node = nodeMap.get(id)!
      const d = dims.get(id)!
      computed.set(id, {
        id, x: pos.x, y: pos.y, width: pos.width, height: pos.height,
        shape: node.shape, label: node.label, sublabel: node.sublabel,
        backgroundColor: colors[node.group ?? id] ?? 'transparent',
        strokeColor: '#1e1e1e', fontSize: d.fontSize, groupId: node.group,
      })
    }
  })

  // Layout each level — skip nodes already pinned
  let maxLevelY = 0
  const maxLevels = Math.max(...Array.from(byLevel.keys()))

  for (let level = 0; level <= maxLevels; level++) {
    const levelNodes = byLevel.get(level) ?? []
    const levelHeight = Math.max(...levelNodes.map(id => dims.get(id)?.h ?? 70))
    const totalWidth = levelNodes.reduce((sum, id) => sum + (dims.get(id)?.w ?? 170), 0)
      + SIBLING_GAP * (levelNodes.length - 1)

    let x = MARGIN + Math.max(0, (800 - totalWidth) / 2)
    const y = MARGIN + level * (levelHeight + LEVEL_GAP)

    levelNodes.forEach(id => {
      if (computed.has(id)) return   // already pinned by merge mode

      const node = nodeMap.get(id)!
      const d = dims.get(id)!
      computed.set(id, {
        id, x, y,
        width: d.w, height: d.h,
        shape: node.shape, label: node.label, sublabel: node.sublabel,
        backgroundColor: colors[node.group ?? node.id] ?? 'transparent',
        strokeColor: '#1e1e1e', fontSize: d.fontSize, groupId: node.group,
      })
      x += d.w + SIBLING_GAP
    })
    maxLevelY = y + levelHeight
  }

  const nodes = Array.from(computed.values())
  return {
    nodes,
    edges: buildEdges(plan.edges),
    canvasWidth: 960,
    canvasHeight: maxLevelY + MARGIN,
    groups: buildGroups(plan.groups, nodes),
  }
}
