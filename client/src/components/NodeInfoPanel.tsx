import { useRef } from 'react'
import { ROLE_DESCRIPTIONS, NO_ROLE_MESSAGE } from '../lib/roleDescriptions'
import type { ClientSemanticState } from '../lib/api'

export interface SelectedNode {
  id:      string
  label:   string
  screenX: number
  screenY: number
}

interface NodeInfoPanelProps {
  node:           SelectedNode
  semanticState:  ClientSemanticState | undefined
  aiExplanation?: string
  onExplain:      (label: string) => void
  onDrillDown:    (label: string) => void
  onClose:        () => void
}

export function NodeInfoPanel({
  node, semanticState, aiExplanation, onExplain, onDrillDown, onClose,
}: NodeInfoPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  const entity   = semanticState?.establishedEntities.find(e => e.id === node.id)
  const roleInfo = entity?.role ? ROLE_DESCRIPTIONS[entity.role] : undefined

  return (
    <div
      ref={ref}
      className="fixed top-1/2 right-4 -translate-y-1/2 z-40 w-72
                 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl
                 overflow-hidden animate-slide-up"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <span className="text-sm text-white/80 truncate pr-2">{node.label}</span>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="text-white/25 hover:text-white/60 text-xs transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {roleInfo ? (
          <>
            <span className="inline-block text-[10px] uppercase tracking-wider
                             text-white/50 bg-white/8 rounded-full px-2 py-0.5">
              {roleInfo.label}
            </span>
            <p className="text-[13px] text-white/65 leading-relaxed">
              {roleInfo.description}
            </p>
            <p className="text-[10px] text-white/25">
              Source: pattern-matched from this diagram's structure — not verified by AI
            </p>
          </>
        ) : (
          <p className="text-[12px] text-white/35 leading-relaxed">
            {NO_ROLE_MESSAGE}
          </p>
        )}

        {aiExplanation && (
          <div className="pt-2 border-t border-white/6">
            <p className="text-[13px] text-white/70 leading-relaxed">{aiExplanation}</p>
            <p className="text-[10px] text-white/25 mt-1">
              Source: AI explanation, this conversation
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onExplain(node.label)}
            title="Sends a message to the AI — uses a model call"
            className="flex-1 text-[11px] text-white/65 hover:text-white
                       bg-white/5 hover:bg-white/10 border border-white/8
                       rounded-lg px-2 py-1.5 transition-colors"
          >
            Ask AI to explain
          </button>
          <button
            onClick={() => onDrillDown(node.label)}
            title="Sends a message to the AI — uses a model call"
            className="flex-1 text-[11px] text-white/65 hover:text-white
                       bg-white/5 hover:bg-white/10 border border-white/8
                       rounded-lg px-2 py-1.5 transition-colors"
          >
            Go deeper ↗
          </button>
        </div>
      </div>
    </div>
  )
}
