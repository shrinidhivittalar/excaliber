import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

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

export function CanvasTopBar({
  title,
  onTitleSave,
  folderName,
  isSaving,
}: CanvasTopBarProps) {
  const [editing,  setEditing]  = useState(false)
  const [value,    setValue]    = useState(title)
  const [visible,  setVisible]  = useState(true)
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
    const onMove = (e: MouseEvent) => { if (e.clientY < 80) reveal() }
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
      className="fixed top-3 left-40 z-[80] flex items-center gap-3
                 rounded-full border border-white/[0.08] bg-zinc-900/80 backdrop-blur-xl
                 px-4 py-2 shadow-[0_2px_20px_rgba(0,0,0,0.5)]
                 transition-all duration-300 min-w-[200px] max-w-[calc(25vw-80px)]"
      style={{
        transform: `translateY(${visible ? '0px' : '-12px'})`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onMouseEnter={reveal}
    >
      {/* Logo + back */}
      <Link
        to="/dashboard"
        className="flex shrink-0 items-center gap-1.5 text-white/50 transition-colors hover:text-white/85"
      >
        <span className="text-sm leading-none text-amber-400">✦</span>
        <span className="hidden text-xs font-medium tracking-tight sm:block">Excaliber</span>
      </Link>

      {folderName && (
        <>
          <span className="shrink-0 select-none text-xs text-white/20">›</span>
          <span className="max-w-[80px] truncate text-xs text-white/30">{folderName}</span>
        </>
      )}

      <span className="shrink-0 select-none text-xs text-white/20">›</span>

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
          className="w-40 rounded-lg border border-amber-500/40 bg-white/10 px-2 py-0.5
                     text-xs text-white outline-none ring-1 ring-amber-500/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to rename"
          className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5
                     text-xs text-white/60 transition-colors hover:text-white/90"
        >
          <span className="max-w-[160px] truncate">{title || 'Untitled Drawing'}</span>
          <span className="text-[9px] text-white/20 opacity-0 transition-opacity group-hover:opacity-100">✎</span>
        </button>
      )}

      {isSaving && <Loader2 size={12} className="shrink-0 animate-spin text-white/30" />}
    </div>
  )
}
