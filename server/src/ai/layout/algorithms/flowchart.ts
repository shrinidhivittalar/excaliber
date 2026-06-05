import type { DiagramPlan, ComputedNode, ComputedLayout } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

const H_GAP = 80   // horizontal gap between nodes
const V_GAP = 60   // vertical gap between rows
const MARGIN = 80

type ExistingPositions = Map<string, { x: number; y: number; width: number; height: number }>

export function layoutFlowchart(
  plan: DiagramPlan,
  existingPositions: ExistingPositions = new Map()
): ComputedLayout {
  const direction = plan.direction ?? 'LR'
  const colors = assignColors(plan.nodes, plan.groups, plan.theme)

  const nodes: ComputedNode[] = []
  const NODES_PER_ROW = direction === 'LR' ? 4 : 3

  let maxRowWidth = 0
  let currentX = MARGIN
  let currentY = MARGIN
  let rowHeight = 0

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
      maxRowWidth = Math.max(maxRowWidth, pos.x + pos.width)
      rowHeight   = Math.max(rowHeight,   pos.height)
      return
    }

    // New node: place at cursor position
    const { width, height, fontSize } = computeNodeDimensions(node.label, node.size, node.shape)

    if (i > 0 && i % NODES_PER_ROW === 0) {
      currentX = MARGIN
      currentY += rowHeight + V_GAP
      rowHeight = 0
    }

    nodes.push({
      id: node.id,
      x: currentX,
      y: currentY,
      width,
      height,
      shape: node.shape,
      label: node.label,
      sublabel: node.sublabel,
      backgroundColor: colors[node.group ?? node.id] ?? 'transparent',
      strokeColor: '#1e1e1e',
      fontSize,
      groupId: node.group,
    })

    maxRowWidth = Math.max(maxRowWidth, currentX + width)
    rowHeight = Math.max(rowHeight, height)
    currentX += width + H_GAP
  })

  const canvasWidth = maxRowWidth + MARGIN
  const canvasHeight = currentY + rowHeight + MARGIN

  return {
    nodes,
    edges: buildEdges(plan.edges),
    canvasWidth,
    canvasHeight,
    groups: buildGroups(plan.groups, nodes),
  }
}
