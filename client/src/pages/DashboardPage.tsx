import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, MoreHorizontal, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { DrawingMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { drawings, isLoading, error, deleteDrawing, updateTitle } = useDashboard()

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">
            ✦ AI Drawing Engine
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-400 sm:inline">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Your Drawings</h1>
          <Button
            onClick={() => navigate('/')}
            className="gap-2 bg-white text-black hover:bg-white/90"
          >
            <Plus className="size-4" />
            New Drawing
          </Button>
        </div>

        {error && (
          <p className="mb-6 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="text-zinc-400">Loading drawings…</p>
        ) : drawings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20 text-center">
            <LayoutGrid className="mb-4 size-10 text-zinc-600" />
            <p className="text-zinc-400">No saved drawings yet — go draw something!</p>
            <Button
              onClick={() => navigate('/')}
              className="mt-6 bg-white text-black hover:bg-white/90"
            >
              Start drawing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drawings.map((drawing) => (
              <DrawingCard
                key={drawing._id}
                drawing={drawing}
                onOpen={() => navigate(`/drawing/${drawing._id}`)}
                onDelete={() => deleteDrawing(drawing._id)}
                onUpdateTitle={(title) => updateTitle(drawing._id, title)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DrawingCard({
  drawing,
  onOpen,
  onDelete,
  onUpdateTitle,
}: {
  drawing: DrawingMeta
  onOpen: () => void
  onDelete: () => void
  onUpdateTitle: (title: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(drawing.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitle(drawing.title)
  }, [drawing.title])

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function commitTitle() {
    const trimmed = title.trim() || 'Untitled Drawing'
    setTitle(trimmed)
    setIsEditing(false)
    if (trimmed !== drawing.title) {
      await onUpdateTitle(trimmed)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setMenuOpen(false)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-zinc-950 p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        {isEditing ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => commitTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setTitle(drawing.title)
                setIsEditing(false)
              }
            }}
            className="h-8 border-white/10 bg-zinc-900 text-sm text-white"
          />
        ) : (
          <h2
            className="cursor-text truncate font-medium text-white"
            onDoubleClick={() => setIsEditing(true)}
            title="Double-click to rename"
          >
            {drawing.title}
          </h2>
        )}
        {drawing.isPublic && (
          <Badge
            variant="secondary"
            className="shrink-0 border-white/10 bg-white/10 text-xs text-zinc-300"
          >
            Shared
          </Badge>
        )}
      </div>

      <p className="mb-4 text-xs text-zinc-500">
        {formatRelativeTime(drawing.updatedAt)}
      </p>

      <div className="mt-auto flex items-center gap-2">
        <Button
          size="sm"
          onClick={onOpen}
          className="flex-1 bg-white text-black hover:bg-white/90"
        >
          Open
        </Button>

        <div className="relative" ref={menuRef}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setMenuOpen((v) => !v)}
            className="border-white/10 bg-transparent text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="More actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-lg">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm text-red-400',
                  'hover:bg-white/5 disabled:opacity-50'
                )}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
