import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

const COLS = 3
const H_GAP = 60
const V_GAP = 50
const MARGIN = 80

type ExistingPositions = Map<string, { x: number; y: number; width: number; height: number }>

export function layoutFreeform(
  plan: DiagramPlan,
  existingPositions: ExistingPositions = new Map()
): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups, plan.theme)
  const nodes: ComputedNode[] = []

  const allDims = plan.nodes.map(n => computeNodeDimensions(n.label, n.size, n.shape))
  const maxW = Math.max(...allDims.map(d => d.width))
  const maxH = Math.max(...allDims.map(d => d.height))

  let newNodeIndex = 0

  plan.nodes.forEach((node, i) => {
    // Merge mode: keep existing nodes at their stored positions
    if (existingPositions.has(node.id)) {
      const pos = existingPositions.get(node.id)!
      const { fontSize } = computeNodeDimensions(node.label, node.size, node.shape)
      nodes.push({
        id: node.id,
        x: pos.x, y: pos.y, width: pos.width, height: pos.height,
        shape: node.shape, label: node.label, sublabel: node.sublabel,
        backgroundColor: colors[node.group ?? node.id] ?? 'transparent',
        strokeColor: '#1e1e1e', fontSize, groupId: node.group,
      })
      return
    }

    // New node: place on grid using only new-node index (so existing nodes don't shift grid)
    const col = newNodeIndex % COLS
    const row = Math.floor(newNodeIndex / COLS)
    const { width, height, fontSize } = allDims[i]

    nodes.push({
      id: node.id,
      x: MARGIN + col * (maxW + H_GAP),
      y: MARGIN + row * (maxH + V_GAP),
      width, height,
      shape: node.shape, label: node.label, sublabel: node.sublabel,
      backgroundColor: colors[node.group ?? node.id] ?? 'transparent',
      strokeColor: '#1e1e1e', fontSize, groupId: node.group,
    })

    newNodeIndex++
  })

  const rows = Math.max(1, Math.ceil(newNodeIndex / COLS))
  return {
    nodes,
    edges: buildEdges(plan.edges),
    canvasWidth: MARGIN * 2 + COLS * (maxW + H_GAP),
    canvasHeight: MARGIN * 2 + rows * (maxH + V_GAP),
    groups: buildGroups(plan.groups, nodes),
  }
}
