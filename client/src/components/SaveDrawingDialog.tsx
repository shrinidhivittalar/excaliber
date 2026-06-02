import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { foldersApi } from '@/lib/api'
import type { Folder, Message } from '@/lib/types'
import { cn } from '@/lib/utils'

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

export function getDefaultDrawingName(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser?.content.trim()) return 'Untitled Drawing'

  const text = firstUser.content.trim().replace(/\s+/g, ' ')
  if (text.length <= 40) return text
  return `${text.slice(0, 40)}…`
}

interface SaveDrawingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: Message[]
  isSaving?: boolean
  onSave: (data: {
    title: string
    folderId: string | null
    tags: string[]
  }) => Promise<void>
}

export function SaveDrawingDialog({
  open,
  onOpenChange,
  messages,
  isSaving = false,
  onSave,
}: SaveDrawingDialogProps) {
  const [title, setTitle] = useState('Untitled Drawing')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState<string>(FOLDER_COLORS[0])
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  useEffect(() => {
    if (!open) return

    setTitle(getDefaultDrawingName(messages))
    setFolderId(null)
    setTags([])
    setTagInput('')
    setShowNewFolder(false)
    setNewFolderName('')

    void foldersApi.list().then(({ data }) => {
      setFolders(data as Folder[])
    })
  }, [open, messages])

  function addTag(raw: string) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH)
    if (!tag) return
    if (tags.length >= MAX_TAGS) return
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    setTags((prev) => [...prev, tag])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    setIsCreatingFolder(true)
    try {
      const { data } = await foldersApi.create({ name: trimmed, color: newFolderColor })
      const folder = data as Folder
      setFolders((prev) =>
        [...prev, folder].sort((a, b) => a.name.localeCompare(b.name))
      )
      setFolderId(folder._id)
      setShowNewFolder(false)
      setNewFolderName('')
    } finally {
      setIsCreatingFolder(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedTitle =
      title.trim().slice(0, MAX_TITLE_LENGTH) || 'Untitled Drawing'
    await onSave({ title: trimmedTitle, folderId, tags })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Drawing</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="drawing-name">Name</Label>
            <Input
              id="drawing-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-select">Folder (optional)</Label>
            <select
              id="folder-select"
              value={showNewFolder ? '__new__' : (folderId ?? '')}
              onChange={(e) => {
                const value = e.target.value
                if (value === '__new__') {
                  setShowNewFolder(true)
                  return
                }
                setShowNewFolder(false)
                setFolderId(value || null)
              }}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder._id} value={folder._id}>
                  {folder.name}
                </option>
              ))}
              <option value="__new__">New folder…</option>
            </select>

            {showNewFolder && (
              <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  maxLength={50}
                  className="border-white/10 bg-black/40 text-sm text-white"
                />
                <div className="flex gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewFolderColor(c)}
                      className={cn(
                        'size-6 rounded-full border-2',
                        newFolderColor === c ? 'border-white' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  onClick={() => void handleCreateFolder()}
                  className="bg-white text-black hover:bg-white/90"
                >
                  {isCreatingFolder ? 'Creating…' : 'Create folder'}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags-input">Tags (optional)</Label>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
              {tags.map((tag) => (
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
              <Input
                id="tags-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length >= MAX_TAGS ? 'Max tags reached' : 'Add tag…'}
                disabled={tags.length >= MAX_TAGS}
                maxLength={MAX_TAG_LENGTH}
                className="min-w-[100px] flex-1 border-0 bg-transparent px-1 text-sm text-white shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="text-[10px] text-white/30">
              {tags.length}/{MAX_TAGS} tags · press Enter or comma to add
            </p>
          </div>

          <DialogFooter className="border-white/10 bg-transparent sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/10 text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-white text-black hover:bg-white/90"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
