import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Save, Share2, Loader2, Undo2, HelpCircle, Clock, Copy, Check } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CanvasTopBarProps {
  title: string
  onTitleSave: (t: string) => void
  folderName: string | null
  currentDrawingId: string | null
  isSaving: boolean
  onSave: () => void
  onShare: () => void
  canUndo: boolean
  onUndo: () => void
  showHistoryToggle: boolean
  historyOpen: boolean
  onHistoryToggle: () => void
  copied: boolean
  onCopyPng: () => void
  autoCorrect: boolean
  onToggleAutoCorrect: () => void
}

function IconBtn({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 ${
            active
              ? 'bg-amber-500/20 text-amber-300'
              : 'text-white/45 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}

export function CanvasTopBar({
  title,
  onTitleSave,
  folderName,
  currentDrawingId,
  isSaving,
  onSave,
  onShare,
  canUndo,
  onUndo,
  showHistoryToggle,
  historyOpen,
  onHistoryToggle,
  copied,
  onCopyPng,
  autoCorrect,
  onToggleAutoCorrect,
}: CanvasTopBarProps) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(title)
  const [visible, setVisible] = useState(true)
  const inputRef  = useRef<HTMLInputElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setValue(title), [title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), 3000)
  }, [])

  const reveal = useCallback(() => {
    setVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    scheduleHide()
    const onMove = (e: MouseEvent) => { if (e.clientY < 72) reveal() }
    const onKey  = () => reveal()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('keydown',   onKey)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('keydown',   onKey)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [reveal, scheduleHide])

  useEffect(() => {
    if (!editing) return
    setVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) onTitleSave(trimmed)
    else setValue(title)
    scheduleHide()
  }

  return (
    <div
      className="fixed top-3 left-1/2 z-[100] flex items-center gap-2
                 rounded-full border border-white/[0.08] bg-zinc-900/80 backdrop-blur-xl
                 px-3 py-1.5 shadow-[0_2px_20px_rgba(0,0,0,0.5)]
                 transition-all duration-300"
      style={{
        transform: `translateX(-50%) translateY(${visible ? '0px' : '-12px'})`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
      onMouseEnter={reveal}
    >
      {/* Logo + back */}
      <Link
        to="/dashboard"
        className="flex shrink-0 items-center gap-1.5 text-white/50 transition-colors hover:text-white/85"
      >
        <span className="text-xs leading-none text-amber-400">✦</span>
        <span className="hidden text-[11px] font-medium tracking-tight sm:block">Excaliber</span>
      </Link>

      {/* Breadcrumb */}
      {folderName && (
        <>
          <span className="shrink-0 text-[10px] text-white/20 select-none">›</span>
          <span className="max-w-[72px] truncate text-[11px] text-white/30">{folderName}</span>
        </>
      )}

      <span className="shrink-0 text-[10px] text-white/20 select-none">›</span>

      {/* Editable title */}
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  commit()
            if (e.key === 'Escape') { setValue(title); setEditing(false) }
          }}
          className="w-36 rounded-lg border border-amber-500/40 bg-white/10 px-2 py-0.5
                     text-[11px] text-white outline-none ring-1 ring-amber-500/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to rename"
          className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5
                     text-[11px] text-white/60 transition-colors hover:text-white/90"
        >
          <span className="max-w-[120px] truncate">{title || 'Untitled Drawing'}</span>
          <span className="text-[9px] text-white/20 opacity-0 transition-opacity group-hover:opacity-100">✎</span>
        </button>
      )}

      {/* Divider */}
      <div className="mx-1 h-3.5 w-px shrink-0 bg-white/[0.1]" />

      {/* Actions */}
      {canUndo && (
        <IconBtn onClick={onUndo} label="Undo last AI action">
          <Undo2 size={13} />
        </IconBtn>
      )}

      {showHistoryToggle && (
        <IconBtn onClick={onHistoryToggle} label="Conversation history" active={historyOpen}>
          <Clock size={13} />
        </IconBtn>
      )}

      <IconBtn onClick={onCopyPng} label="Copy canvas as PNG">
        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      </IconBtn>

      <IconBtn onClick={onSave} label="Save  ⌘S">
        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      </IconBtn>

      {currentDrawingId && (
        <IconBtn onClick={onShare} label="Share drawing">
          <Share2 size={13} />
        </IconBtn>
      )}

      <button
        onClick={onToggleAutoCorrect}
        title={autoCorrect ? 'Auto-correct ON — click to disable' : 'Auto-correct OFF — click to enable'}
        className={`w-8 h-8 flex items-center justify-center rounded-lg border
                    transition-all duration-150
                    ${autoCorrect
                      ? 'bg-white/10 border-white/15 text-white/60'
                      : 'bg-black/50 border-white/8 text-white/20 hover:text-white/50'
                    }`}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5Z"
                stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      </button>

      <div className="mx-0.5 h-3.5 w-px shrink-0 bg-white/[0.08]" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                       text-white/30 transition-all hover:bg-white/10 hover:text-white/65"
          >
            <HelpCircle size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
          You can also manually edit the canvas — changes are saved automatically
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
