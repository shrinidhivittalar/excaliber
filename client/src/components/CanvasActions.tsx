import { useEffect } from 'react'
import { Save, Share2, Loader2 } from 'lucide-react'

interface CanvasActionsProps {
  onSave:            () => void
  onShare:           () => void
  isSaving:          boolean
  currentDrawingId:  string | null
  showHistoryToggle: boolean
  historyOpen:       boolean
  onHistoryToggle:   () => void
}

export function CanvasActions({
  onSave, onShare, isSaving, currentDrawingId,
  showHistoryToggle, historyOpen, onHistoryToggle,
}: CanvasActionsProps) {
  useEffect(() => {
    console.log('[CanvasActions] mounted')
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-1.5">
      {showHistoryToggle && (
        <button
          onClick={onHistoryToggle}
          title="Conversation history"
          className={`w-8 h-8 flex items-center justify-center rounded-lg border
                      transition-all duration-150
                      ${historyOpen
                        ? 'bg-white/15 border-white/20 text-white/80'
                        : 'bg-black/50 border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15'
                      }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      <button
        onClick={onSave}
        title="Save (⌘S)"
        className="w-8 h-8 flex items-center justify-center rounded-lg
                   bg-black/50 border border-white/[0.08] text-white/40
                   hover:text-white/70 hover:border-white/15 transition-all duration-150"
      >
        {isSaving
          ? <Loader2 size={13} className="animate-spin" />
          : <Save size={13} />
        }
      </button>

      {currentDrawingId && (
        <button
          onClick={onShare}
          title="Share drawing"
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     bg-black/50 border border-white/[0.08] text-white/40
                     hover:text-white/70 hover:border-white/15 transition-all duration-150"
        >
          <Share2 size={13} />
        </button>
      )}
    </div>
  )
}
