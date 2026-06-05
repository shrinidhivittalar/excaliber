import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Clock, Loader2, Save, Share2, Trash2 } from 'lucide-react'
import { SaveDrawingDialog } from '@/components/SaveDrawingDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/lib/types'
import { cn, extractDiagramInfo } from '@/lib/utils'

const MAX_CHARS = 1000

const THEME_OPTIONS = [
  { id: 'minimal' as const,  dot: '#94a3b8', label: 'Minimal'  },
  { id: 'default' as const,  dot: '#818cf8', label: 'Default'  },
  { id: 'vibrant' as const,  dot: '#f59e0b', label: 'Vibrant'  },
]

const EXAMPLE_PROMPTS = [
  'Show the water cycle',
  'Draw how TCP/IP handshake works',
  'Visualise merge sort algorithm',
  'Map the solar system',
] as const

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (text: string) => void
  onClear: () => void
  onSave: (options?: {
    title?: string
    folderId?: string | null
    tags?: string[]
  }) => Promise<string | null | void>
  onShare: () => Promise<string | null>
  isSaving: boolean
  currentTitle: string
  onTitleChange: (title: string) => void
  currentDrawingId: string | null
  showVersionHistory?: boolean
  onToggleVersionHistory?: () => void
  onRetry?: () => void
  loadingStage: string
  theme: 'minimal' | 'default' | 'vibrant'
  onThemeChange: (t: 'minimal' | 'default' | 'vibrant') => void
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: Message
  onRetry?: () => void
}) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const { diagramType, usedPlanDiagram } = message.role === 'assistant'
    ? extractDiagramInfo(message.content, message.toolsUsed)
    : { diagramType: null, usedPlanDiagram: false }

  const visibleTools = message.toolsUsed?.filter(
    t => t !== 'plan_diagram' && t !== 'read_me'
  ) ?? []

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div className="group relative">
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
            isUser && 'rounded-br-sm bg-white text-black',
            message.role === 'assistant' && 'rounded-bl-sm bg-white/10 text-white',
            isError && 'rounded-bl-sm bg-red-500/20 text-red-300'
          )}
        >
          {message.content}
        </div>
        {!isUser && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="absolute -bottom-5 left-0 text-[10px] text-white/25 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          >
            ↩ Try again
          </button>
        )}
      </div>

      {message.role === 'assistant' && (diagramType || usedPlanDiagram || visibleTools.length > 0) && (
        <div className="flex gap-1.5 mt-1.5 flex-wrap px-1">
          {diagramType && (
            <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full capitalize">
              {diagramType}
            </span>
          )}
          {visibleTools.map(tool => (
            <span key={`${message.id}-${tool}`} className="text-[10px] text-white/25">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  onClear,
  onSave,
  onShare,
  isSaving,
  currentTitle,
  onTitleChange,
  currentDrawingId,
  showVersionHistory = false,
  onToggleVersionHistory,
  onRetry,
  loadingStage,
  theme,
  onThemeChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(currentTitle)
  const [saveSucceeded, setSaveSucceeded] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOverLimit = input.length > MAX_CHARS
  const canSend = input.trim().length > 0 && !isLoading && !isOverLimit

  useEffect(() => {
    setTitleDraft(currentTitle)
  }, [currentTitle])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!saveSucceeded) return
    const timer = setTimeout(() => setSaveSucceeded(false), 2000)
    return () => clearTimeout(timer)
  }, [saveSucceeded])

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading || isOverLimit) return
    onSendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!pasted) return

    const textarea = e.currentTarget
    const selectionStart = textarea.selectionStart ?? input.length
    const selectionEnd = textarea.selectionEnd ?? input.length
    const nextValue = input.slice(0, selectionStart) + pasted + input.slice(selectionEnd)

    if (nextValue.length > MAX_CHARS) {
      e.preventDefault()
      setInput(nextValue.slice(0, MAX_CHARS))
      showToast('Text trimmed to 1000 characters')
    }
  }

  const handleClear = () => {
    if (window.confirm('Clear all messages and canvas?')) {
      onClear()
    }
  }

  const handleSave = async () => {
    if (!currentDrawingId) {
      setSaveDialogOpen(true)
      return
    }

    try {
      await onSave()
      setSaveSucceeded(true)
    } catch {
      showToast('Failed to save drawing')
    }
  }

  const handleSaveFromDialog = async (data: {
    title: string
    folderId: string | null
    tags: string[]
  }) => {
    try {
      await onSave(data)
      setSaveSucceeded(true)
    } catch {
      showToast('Failed to save drawing')
      throw new Error('Save failed')
    }
  }

  const handleShare = async () => {
    try {
      const url = await onShare()
      if (!url) {
        showToast('Could not create share link')
        return
      }
      showToast('Share link copied!')
    } catch {
      showToast('Failed to copy share link')
    }
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim() || 'Untitled Drawing'
    setTitleDraft(trimmed)
    setIsEditingTitle(false)
    if (trimmed !== currentTitle) {
      onTitleChange(trimmed)
    }
  }

  return (
    <>
    <SaveDrawingDialog
      open={saveDialogOpen}
      onOpenChange={setSaveDialogOpen}
      messages={messages}
      isSaving={isSaving}
      onSave={handleSaveFromDialog}
    />

    <div
      className="chat-panel-enter fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
    >
      {toast && (
        <div className="absolute left-3 right-3 top-14 z-10 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
          {toast}
        </div>
      )}

      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-white">✦ AI Drawing Engine</h2>
            {saveSucceeded && (
              <span className="text-[10px] font-medium text-emerald-400">Saved ✓</span>
            )}
          </div>
          {isEditingTitle ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') {
                  setTitleDraft(currentTitle)
                  setIsEditingTitle(false)
                }
              }}
              className="mt-1 h-7 border-white/10 bg-white/5 text-xs text-white"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="mt-0.5 block max-w-full truncate text-left text-xs text-white/50 hover:text-white/70"
              title="Click to edit title"
            >
              {currentTitle}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <div className="flex items-center gap-1.5 mr-1">
            {THEME_OPTIONS.map(t => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => onThemeChange(t.id)}
                className="rounded-full transition-all duration-150"
                style={{
                  width:      14,
                  height:     14,
                  background: t.dot,
                  opacity:    theme === t.id ? 1 : 0.3,
                  transform:  theme === t.id ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleSave}
            disabled={isSaving}
            className="text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Save drawing"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveSucceeded ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Save className="size-3.5" />
            )}
          </Button>

          {currentDrawingId && onToggleVersionHistory && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onToggleVersionHistory}
              className={cn(
                'text-white/50 hover:bg-white/10 hover:text-white',
                showVersionHistory && 'bg-white/10 text-white'
              )}
              aria-label="Version history"
            >
              <Clock className="size-3.5" />
            </Button>
          )}

          {currentDrawingId && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleShare}
              className="text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Share drawing"
            >
              <Share2 className="size-3.5" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            className="text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Clear chat and canvas"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      <ScrollArea className="chat-scroll-area min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-4 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <p className="text-sm text-white/40">Ask me to draw anything</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    className="cursor-pointer rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const lastInteractiveIdx = messages.reduceRight(
                  (found, m, i) =>
                    found === -1 && (m.role === 'assistant' || m.role === 'error') ? i : found,
                  -1
                )
                return messages.map((message, i) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onRetry={i === lastInteractiveIdx ? onRetry : undefined}
                  />
                ))
              })()}
              {isLoading && (
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-[13px]">{loadingStage}</span>
                      <span className="flex gap-0.5 ml-0.5">
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="w-1 h-1 rounded-full bg-white/40 inline-block"
                            style={{ animation: `bounce 1.1s ease-in-out ${i * 0.18}s infinite` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-1 border-t border-white/10 px-3 py-3">
        {input.length > 0 && (
          <div
            className={cn(
              'px-1 text-right text-[11px]',
              isOverLimit ? 'text-red-400' : 'text-white/30'
            )}
          >
            {input.length}/{MAX_CHARS}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Describe what to draw..."
            disabled={isLoading}
            rows={1}
            className="max-h-[72px] min-h-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm text-white shadow-none placeholder:text-white/30 focus-visible:border-0 focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon-sm"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-50"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}
