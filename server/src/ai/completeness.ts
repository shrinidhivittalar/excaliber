import type { DiagramPlan } from './layout/types'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function checkCompleteness(plan: DiagramPlan, entities: string[]): string[] {
  const haystacks = plan.nodes.map(n =>
    normalize(`${n.label} ${n.sublabel ?? ''}`)
  )

  return entities.filter(entity => {
    const needle = normalize(entity)
    if (needle.length === 0) return false
    return !haystacks.some(h => h.includes(needle) || needle.includes(h))
  })
}
