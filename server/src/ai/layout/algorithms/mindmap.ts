import type { DiagramPlan, ComputedLayout, ComputedNode } from '../types'
import { computeNodeDimensions } from '../sizing'
import { assignColors, buildEdges, buildGroups } from '../utils'

export function layoutMindmap(plan: DiagramPlan): ComputedLayout {
  const colors = assignColors(plan.nodes, plan.groups, plan.theme)
  const edges = plan.edges ?? []

  // First node is always the central concept
  const [central, ...branches] = plan.nodes
  if (!central) return { nodes: [], edges: [], canvasWidth: 800, canvasHeight: 600, groups: [] }

  const centerX = 600
  const centerY = 400
  const radius = Math.max(220, branches.length * 60)

  const allNodes: ComputedNode[] = []

  // Central node — always XL
  const centralDim = computeNodeDimensions(central.label, 'xl', central.shape)
  allNodes.push({
    id: central.id,
    x: centerX - centralDim.width / 2,
    y: centerY - centralDim.height / 2,
    width: centralDim.width,
    height: centralDim.height,
    shape: central.shape,
    label: central.label,
    sublabel: central.sublabel,
    backgroundColor: colors[central.group ?? central.id] ?? 'transparent',
    strokeColor: '#1e1e1e',
    fontSize: centralDim.fontSize,
    groupId: central.group,
  })

  // Branch nodes arranged radially
  branches.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / branches.length - Math.PI / 2
    const { width, height, fontSize } = computeNodeDimensions(node.label, node.size ?? 'md', node.shape)
    const x = centerX + radius * Math.cos(angle) - width / 2
    const y = centerY + radius * Math.sin(angle) - height / 2

    allNodes.push({
      id: node.id,
      x: Math.round(x), y: Math.round(y), width, height,
      shape: node.shape, label: node.label, sublabel: node.sublabel,
      backgroundColor: colors[node.group ?? node.id] ?? '#dcfce7',
      strokeColor: '#1e1e1e', fontSize, groupId: node.group,
    })
  })

  const canvasSize = (radius + 250) * 2
  return {
    nodes: allNodes,
    edges: buildEdges(edges),
    canvasWidth: canvasSize,
    canvasHeight: canvasSize,
    groups: buildGroups(plan.groups, allNodes),
  }
}
