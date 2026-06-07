import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectDiagramType(reply: string): string | null {
  const lower = reply.toLowerCase()
  if (lower.includes('flowchart') || lower.includes('flow chart')) return 'Flowchart'
  if (lower.includes('hierarchy') || lower.includes('tree')) return 'Hierarchy'
  if (lower.includes('cycle') || lower.includes('lifecycle')) return 'Cycle'
  if (lower.includes('timeline')) return 'Timeline'
  if (lower.includes('mindmap') || lower.includes('mind map')) return 'Mind Map'
  if (lower.includes('comparison') || lower.includes('versus')) return 'Comparison'
  return null
}

export function relativeTime(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function extractDiagramInfo(
  reply: string,
  toolsUsed?: string[]
): { diagramType: string | null; usedPlanDiagram: boolean } {
  const usedPlanDiagram = toolsUsed?.includes('plan_diagram') ?? false
  const layouts = ['flowchart', 'hierarchy', 'circular', 'comparison', 'timeline', 'mindmap', 'freeform']
  const lower = reply.toLowerCase()
  const diagramType = layouts.find(l => lower.includes(l)) ?? null
  return { diagramType, usedPlanDiagram }
}
