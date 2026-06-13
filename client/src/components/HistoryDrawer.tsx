import { useEffect, useRef } from 'react'
import type { Message } from '../lib/types'

interface HistoryDrawerProps {
  messages: Message[]
  isOpen:   boolean
  onClose:  () => void
}

export function HistoryDrawer({ messages, isOpen, onClose }: HistoryDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, messages.length])

  if (!isOpen) return null

  const visible = messages.filter(m => m.role === 'user' || m.role === 'assistant')

  return (
    <>
      {/* Click-outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Drawer card */}
      <div className="fixed top-14 right-4 z-50 w-72 max-h-96 flex flex-col
                      bg-zinc-900/95 border border-white/[0.08] rounded-2xl backdrop-blur-2xl
                      shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up">

        <div className="flex items-center justify-between px-4 py-3
                        border-b border-white/[0.06] flex-shrink-0">
          <span className="text-[11px] text-white/35 uppercase tracking-wider">
            History
          </span>
          <button
            onClick={onClose}
            className="text-white/25 hover:text-white/60 text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3
                                        space-y-3 scrollbar-hide">
          {visible.length === 0 ? (
            <p className="text-white/20 text-xs text-center py-6">
              No messages yet
            </p>
          ) : (
            visible.map(msg => (
              <div key={msg.id} className="flex gap-2 items-start">
                <span className={`text-[10px] mt-0.5 flex-shrink-0 w-3 ${msg.role === 'assistant' ? 'text-amber-400/60' : 'text-white/15'}`}>
                  {msg.role === 'user' ? '→' : '✦'}
                </span>
                <p
                  className={`text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white/65'
                      : 'text-white/35'
                  }`}
                >
                  {msg.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
