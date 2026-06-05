import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

const COLS = 3
const H_GAP = 60
const V_GAP = 50
const MARGIN = 80

export function layoutFreeform(plan: DiagramPlan): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups)
  const nodes: ComputedNode[] = []

  const allDims = plan.nodes.map(n => computeNodeDimensions(n.label, n.size, n.shape))
  const maxW = Math.max(...allDims.map(d => d.width))
  const maxH = Math.max(...allDims.map(d => d.height))

  plan.nodes.forEach((node, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
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
  })

  const rows = Math.ceil(plan.nodes.length / COLS)
  return {
    nodes,
    edges: buildEdges(plan.edges),
    canvasWidth: MARGIN * 2 + COLS * (maxW + H_GAP),
    canvasHeight: MARGIN * 2 + rows * (maxH + V_GAP),
    groups: buildGroups(plan.groups, nodes),
  }
}
