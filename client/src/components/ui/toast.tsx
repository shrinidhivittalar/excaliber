import { useEffect, useReducer, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id:      number
  message: string
  type:    ToastType
  exiting: boolean
}

type Action =
  | { type: 'ADD';    payload: Omit<ToastItem, 'exiting'> }
  | { type: 'EXIT';   id: number }
  | { type: 'REMOVE'; id: number }

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case 'ADD':    return [...state, { ...action.payload, exiting: false }]
    case 'EXIT':   return state.map(t => t.id === action.id ? { ...t, exiting: true } : t)
    case 'REMOVE': return state.filter(t => t.id !== action.id)
    default:       return state
  }
}

type Listener = (message: string, type: ToastType) => void
const listeners = new Set<Listener>()

function emit(message: string, type: ToastType) {
  listeners.forEach(fn => fn(message, type))
}

export const toast = {
  success: (message: string) => emit(message, 'success'),
  error:   (message: string) => emit(message, 'error'),
  info:    (message: string) => emit(message, 'info'),
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-emerald-400">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-red-400">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6l-4 4M6 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0 text-indigo-400">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
}

const ACCENT: Record<ToastType, string> = {
  success: 'border-l-emerald-500/60',
  error:   'border-l-red-500/60',
  info:    'border-l-indigo-500/60',
}

let nextId = 1

export function Toaster() {
  const [toasts, dispatch] = useReducer(reducer, [])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  function dismiss(id: number) {
    clearTimeout(timersRef.current.get(id))
    timersRef.current.delete(id)
    dispatch({ type: 'EXIT', id })
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 300)
  }

  useEffect(() => {
    function handle(message: string, type: ToastType) {
      const id = nextId++
      dispatch({ type: 'ADD', payload: { id, message, type } })
      const timer = setTimeout(() => dismiss(id), 3500)
      timersRef.current.set(id, timer)
    }

    listeners.add(handle)
    return () => { listeners.delete(handle) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 border-l-2',
            'bg-zinc-900/95 backdrop-blur-sm px-4 py-3 shadow-2xl shadow-black/60',
            'max-w-[320px] min-w-[220px] text-sm text-white/85',
            ACCENT[t.type],
            t.exiting
              ? 'animate-[toast-out_0.25s_ease-in_forwards]'
              : 'animate-[toast-in_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]',
          )}
        >
          {ICONS[t.type]}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-white/30 transition-colors hover:text-white/70"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
