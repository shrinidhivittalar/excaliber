import { useState, useEffect, useRef } from 'react'

type BarState = 'idle' | 'focused' | 'typing' | 'loading'

const PROMPT_CHIPS = [
  'Show the water cycle',
  'Draw how TCP/IP handshake works',
  'Visualise merge sort algorithm',
  'Map the solar system',
  'Show how React renders',
]

interface CommandBarProps {
  isLoading:    boolean
  loadingStage: string
  onSubmit:     (message: string) => void
}

export function CommandBar({ isLoading, loadingStage, onSubmit }: CommandBarProps) {
  const [barState, setBarState] = useState<BarState>('idle')
  const [value, setValue]       = useState('')
  const inputRef                = useRef<HTMLTextAreaElement>(null)
  const prevLoading             = useRef(false)

  useEffect(() => {
    if (isLoading && barState !== 'loading') {
      setBarState('loading')
    } else if (!isLoading && prevLoading.current) {
      setBarState('idle')
      setValue('')
    }
    prevLoading.current = isLoading
  }, [isLoading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleFocus = () => {
    if (barState === 'loading') return
    setBarState(value.length > 0 ? 'typing' : 'focused')
  }

  const handleBlur = () => {
    if (barState === 'loading') return
    setTimeout(() => setBarState('idle'), 120)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setValue(v)
    setBarState(v.length > 0 ? 'typing' : 'focused')
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || barState === 'loading') return
    onSubmit(trimmed)
    setValue('')
    setBarState('loading')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const handleChipClick = (chip: string) => {
    onSubmit(chip)
    setBarState('loading')
    setValue('')
  }

  if (barState === 'loading') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-[#111111] border border-white/10
                        rounded-full px-5 py-3 shadow-2xl">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/15
                          border-t-white/60 animate-spin flex-shrink-0" />
          <span className="text-white/45 text-sm whitespace-nowrap">
            {loadingStage || 'Drawing...'}
          </span>
        </div>
      </div>
    )
  }

  const showChips   = barState === 'focused'
  const borderColor = (barState === 'focused' || barState === 'typing')
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(255,255,255,0.07)'

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5"
      style={{ minWidth: 480, maxWidth: 640, width: 'calc(100vw - 48px)' }}
    >
      {/* Prompt chips — fade in on focus, fade out when typing */}
      <div
        className="flex gap-2 overflow-x-auto scrollbar-hide w-full px-1 transition-all duration-200"
        style={{
          opacity:       showChips ? 1 : 0,
          pointerEvents: showChips ? 'auto' : 'none',
          transform:     showChips ? 'translateY(0)' : 'translateY(6px)',
        }}
      >
        {PROMPT_CHIPS.map(chip => (
          <button
            key={chip}
            onMouseDown={e => { e.preventDefault(); handleChipClick(chip) }}
            className="whitespace-nowrap flex-shrink-0 text-[11.5px] text-white/50
                       hover:text-white/80 bg-white/5 hover:bg-white/10
                       border border-white/[0.08] hover:border-white/15
                       rounded-full px-3.5 py-1.5 transition-all duration-150"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Main pill bar */}
      <div
        className="flex items-end gap-3 bg-[#111111] rounded-full px-4 py-3
                   shadow-[0_8px_40px_rgba(0,0,0,0.7)] transition-all duration-200 w-full"
        style={{ border: `1px solid ${borderColor}` }}
      >
        <span className="text-white/25 text-sm leading-5 flex-shrink-0 pb-0.5">✦</span>

        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to draw…"
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25
                     resize-none outline-none leading-5 overflow-hidden scrollbar-hide"
          style={{ minHeight: 20, maxHeight: 72 }}
        />

        <button
          onMouseDown={e => { e.preventDefault(); submit() }}
          disabled={!value.trim()}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white flex items-center
                     justify-center disabled:opacity-20 hover:enabled:bg-white/85
                     transition-all duration-150 mb-0.5"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 9.5V1.5M1.5 5.5l4-4 4 4"
                  stroke="#000" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Keyboard hint — only visible when idle */}
      <p
        className="text-[10px] text-white/15 transition-opacity duration-200"
        style={{ opacity: barState === 'idle' ? 1 : 0 }}
      >
        ⌘K to focus · Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
