import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

const COL_GAP = 80
const ROW_GAP = 20
const MARGIN = 80

export function layoutComparison(plan: DiagramPlan): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups)

  // Split nodes into two halves (or use groups if defined)
  const groups = plan.groups ?? []
  let leftNodes = plan.nodes
  let rightNodes: typeof plan.nodes = []

  if (groups.length >= 2) {
    leftNodes = plan.nodes.filter(n => n.group === groups[0].id)
    rightNodes = plan.nodes.filter(n => n.group === groups[1].id)
  } else {
    const mid = Math.ceil(plan.nodes.length / 2)
    leftNodes = plan.nodes.slice(0, mid)
    rightNodes = plan.nodes.slice(mid)
  }

  const maxItems = Math.max(leftNodes.length, rightNodes.length)
  const allDims = plan.nodes.map(n => computeNodeDimensions(n.label, n.size, n.shape))
  const maxWidth = Math.max(...allDims.map(d => d.width))
  const maxHeight = Math.max(...allDims.map(d => d.height))

  const colWidth = maxWidth
  const leftX = MARGIN
  const rightX = MARGIN + colWidth + COL_GAP

  const nodeMap = new Map(plan.nodes.map((n, i) => [n.id, allDims[i]]))
  const computedNodes: ComputedNode[] = []

  const placeCol = (colNodes: typeof plan.nodes, x: number) => {
    let y = MARGIN
    colNodes.forEach(node => {
      const d = nodeMap.get(node.id)!
      computedNodes.push({
        id: node.id, x, y, width: d.width, height: d.height,
        shape: node.shape, label: node.label, sublabel: node.sublabel,
        backgroundColor: colors[node.group ?? node.id] ?? 'transparent',
        strokeColor: '#1e1e1e', fontSize: d.fontSize, groupId: node.group,
      })
      y += d.height + ROW_GAP
    })
  }

  placeCol(leftNodes, leftX)
  placeCol(rightNodes, rightX)

  return {
    nodes: computedNodes,
    edges: buildEdges(plan.edges),
    canvasWidth: rightX + colWidth + MARGIN,
    canvasHeight: MARGIN + maxItems * (maxHeight + ROW_GAP) + MARGIN,
    groups: buildGroups(plan.groups, computedNodes),
  }
}
