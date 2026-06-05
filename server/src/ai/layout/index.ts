import type { DiagramPlan, ComputedLayout, ComputedNode, ComputedEdge } from './types'
import { validateAndFixPlan } from './validation'
import { layoutFlowchart } from './algorithms/flowchart'
import { layoutHierarchy } from './algorithms/hierarchy'
import { layoutCircular } from './algorithms/circular'
import { layoutComparison } from './algorithms/comparison'
import { layoutTimeline } from './algorithms/timeline'
import { layoutMindmap } from './algorithms/mindmap'
import { layoutFreeform } from './algorithms/freeform'

function runLayout(plan: DiagramPlan): ComputedLayout {
  switch (plan.layout) {
    case 'flowchart':  return layoutFlowchart(plan)
    case 'hierarchy':  return layoutHierarchy(plan)
    case 'circular':   return layoutCircular(plan)
    case 'comparison': return layoutComparison(plan)
    case 'timeline':   return layoutTimeline(plan)
    case 'mindmap':    return layoutMindmap(plan)
    case 'freeform':
    default:           return layoutFreeform(plan)
  }
}

function shapeToExcalidrawType(shape: string): string {
  switch (shape) {
    case 'ellipse':  return 'ellipse'
    case 'diamond':  return 'diamond'
    case 'text':     return 'text'
    default:         return 'rectangle'
  }
}

function nodesToElements(nodes: ComputedNode[]): unknown[] {
  return nodes.map(node => {
    const base = {
      type: shapeToExcalidrawType(node.shape),
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      strokeColor: node.strokeColor,
      backgroundColor: node.backgroundColor,
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 1,
      opacity: 100,
      label: {
        text: node.sublabel
          ? `${node.label}\n${node.sublabel}`
          : node.label,
        fontSize: node.fontSize,
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    }

    return base
  })
}

function edgesToElements(edges: ComputedEdge[], nodes: ComputedNode[]): unknown[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  return edges.map((edge, i) => {
    const from = nodeMap.get(edge.fromId)
    const to = nodeMap.get(edge.toId)
    if (!from || !to) return null

    const fromCx = from.x + from.width / 2
    const fromCy = from.y + from.height / 2
    const toCx = to.x + to.width / 2
    const toCy = to.y + to.height / 2

    return {
      type: 'arrow',
      id: `edge_${i}_${edge.fromId}_${edge.toId}`,
      x: fromCx,
      y: fromCy,
      width: toCx - fromCx,
      height: toCy - fromCy,
      points: [[0, 0], [toCx - fromCx, toCy - fromCy]],
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: edge.style === 'dashed' ? 'dashed' : edge.style === 'dotted' ? 'dotted' : 'solid',
      roughness: 1,
      opacity: 100,
      startBinding: { elementId: edge.fromId, focus: 0, gap: 8 },
      endBinding: { elementId: edge.toId, focus: 0, gap: 8 },
      startArrowhead: edge.bidirectional ? 'arrow' : null,
      endArrowhead: 'arrow',
      ...(edge.label ? { label: { text: edge.label, fontSize: 12 } } : {}),
    }
  }).filter(Boolean)
}

function groupsToElements(layout: ComputedLayout): unknown[] {
  return layout.groups
    .filter(g => g.width > 0 && g.height > 0)
    .map((group, i) => ({
      type: 'rectangle',
      id: `group_bg_${group.id}_${i}`,
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      strokeColor: group.color,
      backgroundColor: group.color,
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 15,
      label: {
        text: group.label,
        fontSize: 11,
        textAlign: 'left',
        verticalAlign: 'top',
      },
    }))
}

export function planToExcalidrawElements(plan: DiagramPlan): unknown[] {
  const { valid, errors, warnings, fixed } = validateAndFixPlan(plan)
  if (warnings.length > 0) console.warn('[LAYOUT VALIDATION]', warnings)
  if (!valid) throw new Error(`Invalid diagram plan: ${errors.join(', ')}`)

  const layout = runLayout(fixed!)

  const cameraUpdate = {
    type: 'cameraUpdate',
    fitToContent: true,
  }

  const groupElements = groupsToElements(layout)
  const nodeElements = nodesToElements(layout.nodes)
  const edgeElements = edgesToElements(layout.edges, layout.nodes)

  return [cameraUpdate, ...groupElements, ...nodeElements, ...edgeElements]
}
