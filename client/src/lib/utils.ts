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
