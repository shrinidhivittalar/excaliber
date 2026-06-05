import type { DiagramPlan } from './types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  fixed?: DiagramPlan
}

export function validateAndFixPlan(plan: DiagramPlan): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const fixed = JSON.parse(JSON.stringify(plan)) as DiagramPlan

  // 1. Ensure all node IDs are unique
  const ids = new Set<string>()
  fixed.nodes = fixed.nodes.map((node, i) => {
    if (!node.id) {
      node.id = `node_${i}`
      warnings.push(`Node ${i} had no id — assigned "${node.id}"`)
    }
    if (ids.has(node.id)) {
      node.id = `${node.id}_${i}`
      warnings.push(`Duplicate node id — renamed to "${node.id}"`)
    }
    ids.add(node.id)
    return node
  })

  // 2. Ensure all nodes have a label
  fixed.nodes = fixed.nodes.map((node, i) => {
    if (!node.label || node.label.trim() === '') {
      node.label = `Element ${i + 1}`
      warnings.push(`Node "${node.id}" had no label — using fallback`)
    }
    // Trim very long labels
    if (node.label.length > 40) {
      node.label = node.label.slice(0, 37) + '...'
      warnings.push(`Label truncated for node "${node.id}"`)
    }
    return node
  })

  // 3. Ensure all nodes have a valid shape
  const validShapes = ['rectangle', 'ellipse', 'diamond', 'text']
  fixed.nodes = fixed.nodes.map(node => {
    if (!validShapes.includes(node.shape)) {
      warnings.push(`Invalid shape "${node.shape}" for "${node.id}" — using rectangle`)
      node.shape = 'rectangle'
    }
    return node
  })

  // 4. Remove edges that reference non-existent nodes
  if (fixed.edges) {
    const beforeCount = fixed.edges.length
    fixed.edges = fixed.edges.filter(e => ids.has(e.from) && ids.has(e.to))
    const removed = beforeCount - fixed.edges.length
    if (removed > 0) warnings.push(`Removed ${removed} edge(s) referencing non-existent nodes`)
  }

  // 5. Warn if too many nodes
  if (fixed.nodes.length > 40) {
    errors.push(`Too many nodes (${fixed.nodes.length}) — max 40. Consider splitting into multiple diagrams.`)
  }

  // 6. Validate layout type
  const validLayouts = ['flowchart', 'hierarchy', 'circular', 'comparison', 'timeline', 'mindmap', 'freeform']
  if (!validLayouts.includes(fixed.layout)) {
    warnings.push(`Unknown layout "${fixed.layout}" — using freeform`)
    fixed.layout = 'freeform'
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixed,
  }
}
