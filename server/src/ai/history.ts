export type HistoryMessage = { role: 'user' | 'assistant'; content: string }

export function trimHistory(history: HistoryMessage[]): HistoryMessage[] {
  if (history.length <= 8) return history

  const first = history[0]
  const tail  = history.slice(-6)

  if (tail.some(m => m.content === first.content)) return tail

  return [first, ...tail]
}
