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
