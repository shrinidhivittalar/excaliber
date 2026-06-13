import { useEffect, useRef } from 'react'

export interface SelectedNode {
  id:      string
  label:   string
  screenX: number
  screenY: number
}

interface NodePanelProps {
  node:        SelectedNode
  onExplain:   (label: string) => void
  onDrillDown: (label: string) => void
  onClose:     () => void
}

export function NodePanel({ node, onExplain, onDrillDown, onClose }: NodePanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-px bg-zinc-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-1 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
      style={{
        left:      node.screenX,
        top:       node.screenY - 54,
        transform: 'translateX(-50%)',
      }}
    >
      <button
        onClick={() => { onExplain(node.label); onClose() }}
        className="text-[11px] text-white/65 hover:text-white px-3 py-1.5 rounded-lg hover:bg-amber-500/[0.15] transition-colors whitespace-nowrap"
      >
        Explain
      </button>
      <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
      <button
        onClick={() => { onDrillDown(node.label); onClose() }}
        className="text-[11px] text-white/65 hover:text-white px-3 py-1.5 rounded-lg hover:bg-amber-500/[0.15] transition-colors whitespace-nowrap"
      >
        Go deeper ↗
      </button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <button
        onClick={onClose}
        className="text-[11px] text-white/30 hover:text-white/60 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
