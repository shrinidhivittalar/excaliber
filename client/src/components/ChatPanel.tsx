import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAX_CHARS = 1000

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
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2.5 text-sm text-white">
        <span>Drawing</span>
        <span className="loading-dots ml-0.5 inline-flex">
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
        </span>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
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

      {message.role === 'assistant' && message.toolsUsed && message.toolsUsed.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {message.toolsUsed.map((tool) => (
            <span
              key={`${message.id}-${tool}`}
              className="text-[11px] text-white/30"
            >
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
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOverLimit = input.length > MAX_CHARS
  const canSend = input.trim().length > 0 && !isLoading && !isOverLimit

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

  return (
    <div
      className="chat-panel-enter fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
    >
      {toast && (
        <div className="absolute left-3 right-3 top-14 z-10 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
          {toast}
        </div>
      )}

      <header className="flex shrink-0 items-start justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-white">✦ AI Drawing Engine</h2>
          <p className="text-xs text-white/40">Powered by Groq + Excalidraw</p>
        </div>
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
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && <LoadingBubble />}
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
  )
}
