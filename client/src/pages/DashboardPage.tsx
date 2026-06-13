import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { drawingsApi } from '@/lib/api'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { DrawingMeta, Folder } from '@/lib/types'
import { cn, relativeTime } from '@/lib/utils'

const FOLDER_COLORS = [
  '#6366f1',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
] as const

const MAX_TITLE_LENGTH = 100
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 20

function editedLabel(date: string) {
  const relative = formatRelativeTime(date)
  if (relative === 'just now') return 'Edited just now'
  return `Edited ${relative}`
}

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onClose: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, onClose, enabled])
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const dashboard = useDashboard()
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const getFolderName = (folderId: string | null | undefined) => {
    if (!folderId) return null
    return dashboard.folders.find((f) => f._id === folderId)?.name ?? null
  }

  return (
    <div className="flex min-h-screen bg-black text-white animate-[page-enter_0.2s_ease-out]">
      <aside className="fixed flex h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-zinc-900 to-black">
        <div className="border-b border-white/10 px-4 py-5">
          <h1 className="text-sm font-semibold tracking-tight"><span className="text-amber-400">✦</span> Excaliber</h1>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-3 py-4">
          <Button
            onClick={() => navigate('/')}
            className="mb-4 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400"
          >
            <Plus className="size-4" />
            New Drawing
          </Button>

          <div className="mb-4 h-px bg-white/10" />

          <nav className="flex flex-col gap-0.5">
            <SidebarNavItem
              label="All Drawings"
              count={dashboard.drawings.length}
              active={dashboard.selectedFolderId === 'all'}
              onClick={() => dashboard.setFolderFilter('all')}
            />
            <SidebarNavItem
              label="Unfoldered"
              count={dashboard.unfolderedCount}
              active={dashboard.selectedFolderId === null}
              onClick={() => dashboard.setFolderFilter(null)}
            />
          </nav>

          <div className="mt-4 mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
            Folders
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0.5">
              {dashboard.folders.map((folder) => (
                <FolderNavItem
                  key={folder._id}
                  folder={folder}
                  active={dashboard.selectedFolderId === folder._id}
                  onSelect={() => dashboard.setFolderFilter(folder._id)}
                  onUpdate={(data) => dashboard.updateFolder(folder._id, data)}
                  onDelete={() => dashboard.deleteFolder(folder._id)}
                />
              ))}
            </div>

            <NewFolderPopover onCreate={dashboard.createFolder} />
          </div>
        </div>

        <div className="border-t border-white/10 px-3 py-4">
          <p className="mb-2 truncate px-2 text-xs text-white/50">{user?.email}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="w-full border-white/10 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-3.5" />
            Log out
          </Button>
        </div>
      </aside>

      <main className="relative ml-[240px] flex min-h-screen flex-1 flex-col">
        {/* Dot grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30" />
              <Input
                value={dashboard.searchQuery}
                onChange={(e) => dashboard.setSearch(e.target.value)}
                placeholder="Search drawings and tags..."
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/30"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => dashboard.setViewMode('grid')}
                className={cn(
                  'text-white/50 hover:bg-white/10 hover:text-white',
                  dashboard.viewMode === 'grid' && 'bg-white/10 text-white'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => dashboard.setViewMode('list')}
                className={cn(
                  'text-white/50 hover:bg-white/10 hover:text-white',
                  dashboard.viewMode === 'list' && 'bg-white/10 text-white'
                )}
                aria-label="List view"
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>

          {dashboard.allTags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {dashboard.allTags.map((tag) => {
                const isActive = dashboard.activeTags.some(
                  (t) => t.toLowerCase() === tag.toLowerCase()
                )
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => dashboard.toggleTag(tag)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs transition-colors',
                      isActive
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white/60 hover:bg-white/15'
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
              {dashboard.hasActiveFilters && (
                <button
                  type="button"
                  onClick={dashboard.clearFilters}
                  className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 px-6 py-6">
          {toast && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
              {toast}
            </div>
          )}

          {dashboard.error && (
            <p className="mb-4 text-sm text-red-400" role="alert">
              {dashboard.error}
            </p>
          )}

          {dashboard.isLoading ? (
            <p className="text-white/40">Loading drawings…</p>
          ) : dashboard.drawings.length === 0 ? (
            <EmptyState
              title="No saved drawings yet"
              description="Go draw something and save it from the canvas."
              actionLabel="Start drawing"
              onAction={() => navigate('/')}
            />
          ) : dashboard.filteredDrawings.length === 0 ? (
            <EmptyState
              title="No drawings match your filters"
              description="Try adjusting search, tags, or folder filters."
              actionLabel="Clear filters"
              onAction={dashboard.clearFilters}
            />
          ) : dashboard.viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dashboard.filteredDrawings.map((drawing, index) => (
                <DrawingCard
                  key={drawing._id}
                  index={index}
                  drawing={drawing}
                  onOpen={(id) => navigate(`/drawing/${id}`)}
                  onDelete={(id) => void dashboard.deleteDrawing(id)}
                  onTitleSave={(id, title) => void dashboard.updateTitle(id, title)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {dashboard.filteredDrawings.map((drawing) => (
                <DrawingRow
                  key={drawing._id}
                  drawing={drawing}
                  folderName={getFolderName(drawing.folderId)}
                  folders={dashboard.folders}
                  activeTags={dashboard.activeTags}
                  onOpen={() => navigate(`/drawing/${drawing._id}`)}
                  onDelete={() => dashboard.deleteDrawing(drawing._id)}
                  onUpdateTitle={(title) => dashboard.updateTitle(drawing._id, title)}
                  onUpdateTags={(tags) => dashboard.updateTags(drawing._id, tags)}
                  onMove={(folderId) => dashboard.moveDrawing(drawing._id, folderId)}
                  onTagClick={dashboard.toggleTag}
                  onShare={async () => {
                    const { data } = await drawingsApi.share(drawing._id)
                    if (data.shareId) {
                      const url = `${window.location.origin}/share/${data.shareId}`
                      await navigator.clipboard.writeText(url)
                      showToast('Share link copied!')
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20 text-center">
      <svg width="64" height="52" viewBox="0 0 64 52" fill="none" className="mb-5 text-white/[0.09]">
        <rect x="2"  y="2"  width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2.5"/>
        <rect x="38" y="2"  width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2.5"/>
        <rect x="20" y="34" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2.5"/>
        <path d="M14 18v6M50 18v6M14 24h18M50 24H32M32 24v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <p className="font-medium text-white/80">{title}</p>
      <p className="mt-1 text-sm text-white/40">{description}</p>
      <Button
        onClick={onAction}
        className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-400 hover:to-orange-400"
      >
        {actionLabel}
      </Button>
    </div>
  )
}

function SidebarNavItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg py-2 text-sm transition-all duration-150 border-l-2',
        active
          ? 'border-amber-500 bg-amber-500/[0.12] pl-2.5 pr-3 text-white'
          : 'border-transparent px-3 text-white/60 hover:bg-white/5 hover:text-white'
      )}
    >
      <span>{label}</span>
      <span className="text-xs text-white/40">{count}</span>
    </button>
  )
}

function FolderNavItem({
  folder,
  active,
  onSelect,
  onUpdate,
  onDelete,
}: {
  folder: Folder
  active: boolean
  onSelect: () => void
  onUpdate: (data: { name?: string; color?: string }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg py-2 pr-14 text-sm transition-all duration-150 border-l-2',
          active
            ? 'border-amber-500 bg-amber-500/[0.12] pl-2.5 text-white'
            : 'border-transparent pl-3 text-white/60 hover:bg-white/5 hover:text-white'
        )}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: folder.color }}
        />
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto text-xs text-white/40">
          {folder.drawingCount ?? 0}
        </span>
      </button>

      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
          }}
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label={`Edit ${folder.name}`}
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`Delete folder "${folder.name}"? Drawings will be unfoldered.`)) {
              void onDelete()
            }
          }}
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-400"
          aria-label={`Delete ${folder.name}`}
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {isEditing && (
        <EditFolderPopover
          folder={folder}
          onClose={() => setIsEditing(false)}
          onSave={async (data) => {
            await onUpdate(data)
            setIsEditing(false)
          }}
        />
      )}
    </div>
  )
}

function NewFolderPopover({
  onCreate,
}: {
  onCreate: (name: string, color?: string) => Promise<Folder>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(FOLDER_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false), open)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    try {
      await onCreate(trimmed, color)
      setName('')
      setColor(FOLDER_COLORS[0])
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative mt-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/5 hover:text-white/80"
      >
        <Plus className="size-3.5" />
        New Folder
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-xl"
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={50}
            className="mb-3 border-white/10 bg-white/5 text-sm text-white"
          />
          <div className="mb-3 flex gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'size-6 rounded-full border-2 transition-transform',
                  color === c ? 'scale-110 border-white' : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!name.trim() || isSubmitting}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            Create
          </Button>
        </form>
      )}
    </div>
  )
}

function EditFolderPopover({
  folder,
  onClose,
  onSave,
}: {
  folder: Folder
  onClose: () => void
  onSave: (data: { name?: string; color?: string }) => Promise<void>
}) {
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const ref = useRef<HTMLFormElement>(null)

  useClickOutside(ref, onClose, true)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    try {
      await onSave({ name: trimmed, color })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      className="absolute top-full left-0 z-30 mt-1 w-56 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-xl"
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={50}
        className="mb-3 border-white/10 bg-white/5 text-sm text-white"
      />
      <div className="mb-3 flex gap-2">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={cn(
              'size-6 rounded-full border-2',
              color === c ? 'border-white' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="flex-1 border-white/10 text-white/70"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || isSubmitting}
          className="flex-1 bg-white text-black hover:bg-white/90"
        >
          Save
        </Button>
      </div>
    </form>
  )
}

function TagPills({
  tags,
  activeTags,
  onTagClick,
}: {
  tags: string[]
  activeTags: string[]
  onTagClick: (tag: string) => void
}) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isActive = activeTags.some(
          (t) => t.toLowerCase() === tag.toLowerCase()
        )
        return (
          <button
            key={tag}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTagClick(tag)
            }}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] transition-colors',
              isActive
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/50 hover:bg-white/15'
            )}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}

function TagsEditorPopover({
  tags,
  onSave,
  onClose,
}: {
  tags: string[]
  onSave: (tags: string[]) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<string[]>(tags)
  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, onClose, true)

  function addTag(raw: string) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH)
    if (!tag) return
    if (draft.length >= MAX_TAGS) return
    if (draft.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    setDraft((prev) => [...prev, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    setDraft((prev) => prev.filter((t) => t !== tag))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-medium text-white/60">Edit tags</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {draft.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-white/40 hover:text-white"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(input)
          }
        }}
        onBlur={() => addTag(input)}
        placeholder="Add tag..."
        maxLength={MAX_TAG_LENGTH}
        disabled={draft.length >= MAX_TAGS}
        className="mb-3 border-white/10 bg-white/5 text-sm text-white"
      />
      <p className="mb-3 text-[10px] text-white/30">
        {draft.length}/{MAX_TAGS} tags · max {MAX_TAG_LENGTH} chars
      </p>
      <Button
        type="button"
        size="sm"
        disabled={isSaving}
        onClick={handleSave}
        className="w-full bg-white text-black hover:bg-white/90"
      >
        Save
      </Button>
    </div>
  )
}

function DrawingActionsMenu({
  drawing,
  folders,
  onShare,
  onMove,
  onEditTags,
  onDelete,
}: {
  drawing: DrawingMeta
  folders: Folder[]
  onShare: () => Promise<void>
  onMove: (folderId: string | null) => Promise<void>
  onEditTags: () => void
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [showMove, setShowMove] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-white/10 bg-zinc-950 py-1 shadow-lg">
      <button
        type="button"
        onClick={() => void onShare()}
        className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
      >
        Share
      </button>
      <button
        type="button"
        onClick={() => setShowMove((v) => !v)}
        className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
      >
        Move to folder
      </button>
      {showMove && (
        <div className="border-t border-white/10 py-1">
          <button
            type="button"
            onClick={() => void onMove(null)}
            className={cn(
              'w-full px-4 py-1.5 text-left text-xs text-white/60 hover:bg-white/5',
              !drawing.folderId && 'text-white'
            )}
          >
            Unfoldered
          </button>
          {folders.map((folder) => (
            <button
              key={folder._id}
              type="button"
              onClick={() => void onMove(folder._id)}
              className={cn(
                'flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs text-white/60 hover:bg-white/5',
                drawing.folderId === folder._id && 'text-white'
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: folder.color }}
              />
              {folder.name}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onEditTags}
        className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
      >
        Edit tags
      </button>
      <button
        type="button"
        disabled={isDeleting}
        onClick={async () => {
          setIsDeleting(true)
          try {
            await onDelete()
          } finally {
            setIsDeleting(false)
          }
        }}
        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

function useDrawingMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, () => {
    setMenuOpen(false)
    setTagsOpen(false)
  }, menuOpen || tagsOpen)

  return { menuOpen, setMenuOpen, tagsOpen, setTagsOpen, menuRef }
}

function DrawingCard({
  drawing,
  onOpen,
  onDelete,
  onTitleSave,
  index = 0,
}: {
  drawing:     DrawingMeta
  onOpen:      (id: string) => void
  onDelete:    (id: string) => void
  onTitleSave: (id: string, title: string) => void
  index?:      number
}) {
  const [editing,    setEditing]    = useState(false)
  const [titleVal,   setTitleVal]   = useState(drawing.title)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [mouse,      setMouse]      = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  const handleMouseLeave = () => setMouse(null)

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  const commitTitle = () => {
    setEditing(false)
    const t = titleVal.trim()
    if (t && t !== drawing.title) onTitleSave(drawing._id, t)
    else setTitleVal(drawing.title)
  }

  async function handleShare() {
    try {
      const { data } = await drawingsApi.share(drawing._id)
      if (data.shareId) {
        const url = `${window.location.origin}/share/${data.shareId}`
        await navigator.clipboard.writeText(url)
        setLinkCopied(true)
        setMenuOpen(false)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    } catch (err) {
      console.error('[DrawingCard] share failed', err)
    }
  }

  return (
    <div
      ref={cardRef}
      className="border border-white/[0.08] rounded-xl
                 hover:border-white/[0.18] hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                 transition-all duration-200 group cursor-pointer relative
                 animate-[stagger-fade-up_0.4s_ease-out_both]"
      style={{
        background: mouse
          ? `radial-gradient(280px at ${mouse.x}px ${mouse.y}px, rgba(245,158,11,0.08), rgba(255,255,255,0.04) 70%)`
          : 'rgba(255,255,255,0.04)',
        animationDelay: `${Math.min(index * 50, 400)}ms`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => !editing && !menuOpen && onOpen(drawing._id)}
    >
      {/* Thumbnail area — overflow-hidden + rounded-t-xl clips image to card corners */}
      <div className="h-40 bg-white/[0.03] relative overflow-hidden flex-shrink-0 rounded-t-xl">
        {drawing.thumbnail ? (
          <img
            src={drawing.thumbnail}
            alt={drawing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
                 className="text-white/10">
              <rect x="2"  y="6"  width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="16" y="6"  width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9"  y="18" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 13v3.5M21 13v3.5M14 13v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-white/15 text-[10px]">No preview</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onOpen(drawing._id) }}
            className="text-[11px] text-white bg-white/15 hover:bg-white/25
                       border border-white/20 rounded-lg px-3 py-1.5 transition-colors"
          >
            Open
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(drawing._id) }}
            className="text-[11px] text-white/60 hover:text-white bg-white/[0.08]
                       hover:bg-red-500/30 border border-white/10 rounded-lg
                       px-3 py-1.5 transition-colors"
          >
            Delete
          </button>
        </div>

        {drawing.isPublic && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400/80" title="Shared" />
        )}
      </div>

      {/* Card footer */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                autoFocus
                value={titleVal}
                maxLength={100}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter')  commitTitle()
                  if (e.key === 'Escape') { setTitleVal(drawing.title); setEditing(false) }
                }}
                onClick={e => e.stopPropagation()}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5
                           text-sm text-white outline-none"
              />
            ) : (
              <p
                className="text-sm text-white/75 truncate cursor-text"
                onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
                title="Double-click to rename"
              >
                {drawing.title}
              </p>
            )}
            <p className="text-xs text-white/25 mt-0.5">
              {relativeTime(drawing.updatedAt)}
            </p>
            {drawing.tags?.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {drawing.tags.slice(0, 3).map(tag => (
                  <span key={tag}
                        className="text-[10px] text-white/30 bg-white/5 rounded-full px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* "..." context menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            {linkCopied ? (
              <span className="text-[11px] text-emerald-400 px-1.5 py-0.5">Link copied</span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                className="ml-auto text-white/25 hover:text-white/60 text-sm
                           px-1.5 py-0.5 rounded transition-colors"
              >
                ...
              </button>
            )}

            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 bg-[#1a1a1a] border
                              border-white/10 rounded-xl overflow-hidden shadow-xl z-10
                              min-w-[120px]">
                <button
                  onClick={e => { e.stopPropagation(); setEditing(true); setMenuOpen(false) }}
                  className="w-full text-left text-xs text-white/55 hover:text-white
                             hover:bg-white/8 px-3 py-2 transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={e => { e.stopPropagation(); void handleShare() }}
                  className="w-full text-left text-xs text-white/55 hover:text-white
                             hover:bg-white/8 px-3 py-2 transition-colors"
                >
                  Share
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (window.confirm('Delete this drawing?')) {
                      onDelete(drawing._id)
                      setMenuOpen(false)
                    }
                  }}
                  className="w-full text-left text-xs text-white/55 hover:text-white
                             hover:bg-white/8 px-3 py-2 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DrawingRow({
  drawing,
  folderName,
  folders,
  activeTags,
  onOpen,
  onDelete,
  onUpdateTitle,
  onUpdateTags,
  onMove,
  onTagClick,
  onShare,
}: {
  drawing: DrawingMeta
  folderName: string | null
  folders: Folder[]
  activeTags: string[]
  onOpen: () => void
  onDelete: () => Promise<void>
  onUpdateTitle: (title: string) => Promise<void>
  onUpdateTags: (tags: string[]) => Promise<void>
  onMove: (folderId: string | null) => Promise<void>
  onTagClick: (tag: string) => void
  onShare: () => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(drawing.title)
  const { menuOpen, setMenuOpen, tagsOpen, setTagsOpen, menuRef } = useDrawingMenu()

  useEffect(() => {
    setTitle(drawing.title)
  }, [drawing.title])

  async function commitTitle() {
    const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH) || 'Untitled Drawing'
    setTitle(trimmed)
    setIsEditing(false)
    if (trimmed !== drawing.title) {
      await onUpdateTitle(trimmed)
    }
  }

  return (
    <article className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-150 hover:border-white/[0.18] hover:bg-white/[0.07]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <Input
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') {
                  setTitle(drawing.title)
                  setIsEditing(false)
                }
              }}
              className="h-8 max-w-xs border-white/10 bg-white/5 text-sm text-white"
            />
          ) : (
            <h2
              className="cursor-text truncate font-medium text-white"
              onDoubleClick={() => setIsEditing(true)}
            >
              {drawing.title}
            </h2>
          )}
          {drawing.isPublic && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Shared
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <TagPills tags={drawing.tags} activeTags={activeTags} onTagClick={onTagClick} />
          {folderName && (
            <span className="text-xs text-white/40">{folderName}</span>
          )}
          <span className="text-xs text-white/40">{editedLabel(drawing.updatedAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={onOpen}
          className="bg-white text-black hover:bg-white/90"
        >
          Open
        </Button>

        <div className="relative" ref={menuRef}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setMenuOpen((v) => !v)
              setTagsOpen(false)
            }}
            className="border-white/10 bg-transparent text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="More actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>

          {menuOpen && !tagsOpen && (
            <DrawingActionsMenu
              drawing={drawing}
              folders={folders}
              onShare={onShare}
              onMove={async (folderId) => {
                await onMove(folderId)
                setMenuOpen(false)
              }}
              onEditTags={() => {
                setMenuOpen(false)
                setTagsOpen(true)
              }}
              onDelete={async () => {
                await onDelete()
                setMenuOpen(false)
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}

          {tagsOpen && (
            <TagsEditorPopover
              tags={drawing.tags}
              onSave={onUpdateTags}
              onClose={() => setTagsOpen(false)}
            />
          )}
        </div>
      </div>
    </article>
  )
}
