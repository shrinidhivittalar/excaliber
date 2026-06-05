import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

export function layoutCircular(plan: DiagramPlan): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups, plan.theme)
  const N = plan.nodes.length

  if (N === 0) return { nodes: [], edges: [], canvasWidth: 800, canvasHeight: 600, groups: [] }

  // If only 1 node, just center it
  if (N === 1) {
    const node = plan.nodes[0]
    const { width, height, fontSize } = computeNodeDimensions(node.label, node.size, node.shape)
    return {
      nodes: [{ id: node.id, x: 400 - width/2, y: 300 - height/2, width, height,
        shape: node.shape, label: node.label, sublabel: node.sublabel,
        backgroundColor: colors[node.group ?? node.id] ?? '#dbeafe',
        strokeColor: '#1e1e1e', fontSize, groupId: node.group }],
      edges: buildEdges(plan.edges),
      canvasWidth: 800, canvasHeight: 600,
      groups: [],
    }
  }

  // Find max node dimension to set radius
  const allDims = plan.nodes.map(n => computeNodeDimensions(n.label, n.size, n.shape))
  const maxDim = Math.max(...allDims.map(d => Math.max(d.width, d.height)))
  const radius = Math.max(200, N * (maxDim + 40) / (2 * Math.PI))

  const centerX = radius + 150
  const centerY = radius + 150
  const canvasSize = (radius + 200) * 2

  const nodes: ComputedNode[] = plan.nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2  // start from top
    const { width, height, fontSize } = allDims[i]
    const x = centerX + radius * Math.cos(angle) - width / 2
    const y = centerY + radius * Math.sin(angle) - height / 2

    return {
      id: node.id,
      x: Math.round(x),
      y: Math.round(y),
      width,
      height,
      shape: node.shape,
      label: node.label,
      sublabel: node.sublabel,
      backgroundColor: colors[node.group ?? node.id] ?? '#dbeafe',
      strokeColor: '#1e1e1e',
      fontSize,
      groupId: node.group,
    }
  })

  return {
    nodes,
    edges: buildEdges(plan.edges),
    canvasWidth: Math.round(canvasSize),
    canvasHeight: Math.round(canvasSize),
    groups: buildGroups(plan.groups, nodes),
  }
}
