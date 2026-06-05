import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { buildGroups } from '../utils'

const H_GAP = 60
const MARGIN = 80
const AXIS_Y = 350

export function layoutTimeline(plan: DiagramPlan): ComputedLayout {
  const allDims = plan.nodes.map(n => computeNodeDimensions(n.label, n.size, n.shape))

  const nodes: ComputedNode[] = plan.nodes.map((node, i) => {
    const { width, height, fontSize } = allDims[i]
    const x = MARGIN + i * (width + H_GAP)
    // Alternate above and below axis
    const above = i % 2 === 0
    const y = above ? AXIS_Y - height - 40 : AXIS_Y + 40

    return {
      id: node.id, x, y, width, height,
      shape: node.shape, label: node.label, sublabel: node.sublabel,
      backgroundColor: '#dbeafe',
      strokeColor: '#1e1e1e', fontSize, groupId: node.group,
    }
  })

  const totalWidth = plan.nodes.reduce((sum, _, i) => sum + allDims[i].width + H_GAP, MARGIN * 2)

  return {
    nodes,
    edges: [],   // timeline uses the axis line, not edges
    canvasWidth: totalWidth,
    canvasHeight: 700,
    groups: buildGroups(plan.groups, nodes),
  }
}
