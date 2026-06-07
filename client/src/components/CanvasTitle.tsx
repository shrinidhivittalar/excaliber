import { useState, useEffect, useRef } from 'react'

interface CanvasTitleProps {
  title:  string
  onSave: (title: string) => void
}

export function CanvasTitle({ title, onSave }: CanvasTitleProps) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(title)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => setValue(title), [title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) onSave(trimmed)
    else setValue(title)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        maxLength={100}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  commit()
          if (e.key === 'Escape') { setValue(title); setEditing(false) }
        }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-52 text-center
                   text-sm text-white bg-black/70 border border-white/20 rounded-lg
                   px-3 py-1.5 outline-none"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 group flex items-center
                 gap-1.5 text-xs text-white/30 hover:text-white/65 transition-colors
                 px-3 py-1.5 rounded-lg hover:bg-black/40"
    >
      <span className="max-w-[180px] truncate">{title}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20">✎</span>
    </button>
  )
}
