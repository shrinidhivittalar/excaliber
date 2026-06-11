import { useState, useEffect, useRef } from 'react'

type BarState = 'idle' | 'focused' | 'typing' | 'loading'

const PROMPT_CHIPS = [
  'Show the water cycle',
  'Draw how TCP/IP handshake works',
  'Visualise merge sort algorithm',
  'Map the solar system',
  'Show how React renders',
]

const LOADING_CYCLE = ['Thinking...', 'Asking AI...', 'Almost there...']

function detectContentType(
  content: string,
  filename?: string
): { label: string; layout: string } | null {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext) {
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rs', 'cpp', 'c'].includes(ext))
      return { label: 'Code file', layout: 'hierarchy' }
    if (['md', 'mdx'].includes(ext)) return { label: 'Markdown', layout: 'mindmap' }
    if (ext === 'json')              return { label: 'JSON', layout: 'hierarchy' }
    if (['yaml', 'yml'].includes(ext)) return { label: 'YAML', layout: 'hierarchy' }
    if (ext === 'csv')               return { label: 'Data file', layout: 'comparison' }
  }
  const c = content.slice(0, 500).trim()
  if (!c) return null
  if (/^[\[{]/.test(c))                                          return { label: 'JSON', layout: 'hierarchy' }
  if (/^---/.test(c) || /^\w[\w-]*:\s/m.test(c))                return { label: 'YAML', layout: 'hierarchy' }
  if (/^#{1,3} /m.test(c))                                       return { label: 'Markdown', layout: 'mindmap' }
  if (/^(import |export |class |function |const |def |package )/m.test(c))
                                                                 return { label: 'Code file', layout: 'hierarchy' }
  if (/^(GET|POST|PUT|DELETE|PATCH) \//m.test(c))               return { label: 'API spec', layout: 'flowchart' }
  return null
}

interface CommandBarProps {
  isLoading:    boolean
  loadingStage: string
  onSubmit:     (message: string) => void
  onIngest:     (content: string, filename?: string) => Promise<void>
}

export function CommandBar({ isLoading, loadingStage, onSubmit, onIngest }: CommandBarProps) {
  const [barState, setBarState] = useState<BarState>('idle')
  const [value, setValue]       = useState('')
  const inputRef                = useRef<HTMLTextAreaElement>(null)
  const prevLoading             = useRef(false)

  const [showIngest,     setShowIngest]     = useState(false)
  const [ingestContent,  setIngestContent]  = useState('')
  const [ingestFilename, setIngestFilename] = useState<string | undefined>()
  const [ingestLoading,  setIngestLoading]  = useState(false)
  const [ingestError,    setIngestError]    = useState<string | null>(null)

  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const [cycleIdx, setCycleIdx] = useState(0)

  // Cycle loading messages while waiting for AI
  useEffect(() => {
    if (barState !== 'loading' && !ingestLoading) { setCycleIdx(0); return }
    const t = setInterval(() => setCycleIdx(i => (i + 1) % LOADING_CYCLE.length), 2500)
    return () => clearInterval(t)
  }, [barState, ingestLoading])

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
      if (e.key === 'Escape') {
        if (listening) stopListening()
        else if (document.activeElement === inputRef.current) inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [listening])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
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

  const submit = (overrideValue?: string) => {
    const trimmed = (overrideValue ?? value).trim()
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

  function closeIngest() {
    setShowIngest(false)
    setIngestContent('')
    setIngestFilename(undefined)
    setIngestError(null)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50_000) {
      setIngestError('File too large — keep it under 50KB')
      return
    }

    const text = await file.text()
    setIngestContent(text)
    setIngestFilename(file.name)
    setIngestError(null)
    e.target.value = ''
  }

  async function handleIngestSubmit() {
    if (!ingestContent.trim() || ingestLoading) return
    setIngestLoading(true)
    setIngestError(null)
    try {
      await onIngest(ingestContent.trim(), ingestFilename)
      closeIngest()
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Failed to generate diagram')
    } finally {
      setIngestLoading(false)
    }
  }

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognitionRef.current = recognition

    recognition.continuous     = false
    recognition.interimResults = true
    recognition.lang           = 'en-US'

    recognition.onstart = () => {
      setListening(true)
      setValue('')
      setBarState('focused')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(event.results as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join('')

      setValue(transcript)
      setBarState('typing')

      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height =
          Math.min(inputRef.current.scrollHeight, 72) + 'px'
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((event.results as any)[event.results.length - 1].isFinal) {
        setListening(false)
        if (transcript.trim()) {
          setTimeout(() => submit(transcript.trim()), 600)
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setListening(false)
      if (event.error !== 'aborted') console.warn('[VOICE]', event.error)
    }

    recognition.onend = () => setListening(false)
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  if (barState === 'loading' || ingestLoading) {
    const label = ingestLoading
      ? 'Analysing document...'
      : loadingStage !== 'Thinking...'
        ? loadingStage
        : LOADING_CYCLE[cycleIdx]

    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-[#111111] border border-white/10
                        rounded-full px-5 py-3 shadow-2xl">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/15
                          border-t-white/60 animate-spin flex-shrink-0" />
          <span className="text-white/45 text-sm whitespace-nowrap">{label}</span>
        </div>
      </div>
    )
  }

  const isVoiceSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const showChips   = barState === 'focused'
  const borderColor = (barState === 'focused' || barState === 'typing')
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(255,255,255,0.07)'

  const detected = detectContentType(ingestContent, ingestFilename)

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5"
      style={{ minWidth: 480, maxWidth: 640, width: 'calc(100vw - 48px)' }}
    >
      {/* Ingest overlay — above chips */}
      {showIngest && (
        <div
          className="w-full bg-[#111111] border border-white/10 rounded-2xl
                     p-4 shadow-2xl animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-white/40">
              Paste a README, code file, API spec, or any document
            </p>
            <button onClick={closeIngest} className="text-white/25 hover:text-white/60 text-xs transition-colors">
              ✕
            </button>
          </div>

          <textarea
            value={ingestContent}
            onChange={e => { setIngestContent(e.target.value); setIngestFilename(undefined); setIngestError(null) }}
            placeholder="Paste content here..."
            className="w-full h-32 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3
                       text-xs text-white/65 placeholder:text-white/20
                       outline-none resize-none focus:border-white/15 transition-colors
                       scrollbar-hide"
          />

          {/* Content-type preview badge */}
          {detected && (
            <p className="text-[10px] text-white/25 mt-1.5">
              Detected: <span className="text-white/45">{detected.label}</span>
              {' → '}
              <span className="text-white/45">{detected.layout} layout</span>
            </p>
          )}

          {ingestError && (
            <p className="text-[11px] text-red-400/80 mt-1.5">{ingestError}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <label className="text-[11px] text-white/30 hover:text-white/55 cursor-pointer transition-colors">
              ↑ Upload file (.md .ts .js .py .json .yaml)
              <input
                type="file"
                accept=".md,.txt,.ts,.tsx,.js,.jsx,.py,.go,.json,.yaml,.yml,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] transition-colors ${ingestContent.length > 10000 ? 'text-amber-400/70' : 'text-white/20'}`}>
                {ingestContent.length > 0 ? `${ingestContent.length} / 12,000` : ''}
              </span>
              <button
                onClick={handleIngestSubmit}
                disabled={!ingestContent.trim() || ingestLoading}
                className="text-[11px] text-white bg-white/10 hover:bg-white/[0.18]
                           border border-white/10 rounded-lg px-3 py-1.5
                           disabled:opacity-30 transition-all duration-150"
              >
                {ingestLoading ? 'Analysing...' : 'Generate diagram'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt chips — fade in on focus */}
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
        className={`flex gap-3 bg-[#111111] rounded-full px-4 py-3
                   shadow-[0_8px_40px_rgba(0,0,0,0.7)] transition-all duration-200 w-full
                   ${listening ? 'items-center' : 'items-end'}`}
        style={{ border: `1px solid ${listening ? 'rgba(248,113,113,0.25)' : borderColor}` }}
      >
        <span
          className="text-white/25 text-sm leading-5 flex-shrink-0"
          title={isVoiceSupported ? 'Type, speak (mic), or attach a file (📎)' : 'Type a prompt or attach a file (📎)'}
        >✦</span>

        <button
          onMouseDown={e => { e.preventDefault(); setShowIngest(v => !v) }}
          title="Diagram from document (paste or upload)"
          className={`flex-shrink-0 self-center transition-colors duration-150 ${
            showIngest ? 'text-white/70' : 'text-white/20 hover:text-white/50'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5L5.5 12a3.5 3.5 0 0 1-4.95-4.95l6-6a2 2 0 0 1 2.83 2.83L4 9.17a.75.75 0 0 1-1.06-1.06L8.5 2.56"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Waveform shown inside pill while listening */}
        {listening ? (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-end gap-[3px]" style={{ height: 16 }}>
              {[0, 0.15, 0.08, 0.22, 0.05].map((delay, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-red-400/70 wave-bar"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-white/30 truncate">
              {value || 'Listening…'}
            </span>
          </div>
        ) : (
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
        )}

        {isVoiceSupported && (
          <button
            onMouseDown={e => {
              e.preventDefault()
              listening ? stopListening() : startListening()
            }}
            title={listening ? 'Stop listening (click or press Esc)' : 'Speak your prompt'}
            className={`flex-shrink-0 transition-all duration-200 ${
              listening ? 'text-red-400 scale-110' : 'text-white/20 hover:text-white/55 pb-0.5'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="4.5" y="1" width="4" height="6" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 6.5a4.5 4.5 0 0 0 9 0M6.5 11v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        <button
          onMouseDown={e => { e.preventDefault(); submit() }}
          disabled={!value.trim()}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white flex items-center
                     justify-center disabled:opacity-20 hover:enabled:bg-white/85
                     transition-all duration-150"
          style={{ marginBottom: listening ? 0 : 2 }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 9.5V1.5M1.5 5.5l4-4 4 4" stroke="#000" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <p
        className="text-[10px] text-white/15 transition-opacity duration-200"
        style={{ opacity: barState === 'idle' && !listening ? 1 : 0 }}
      >
        ⌘K to focus · Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
