import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { VersionMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

interface VersionHistoryPanelProps {
  open: boolean
  onClose: () => void
  versions: VersionMeta[]
  isLoading?: boolean
  currentVersionNumber: number | null
  onRestore: (versionId: string, versionNumber: number) => Promise<void>
}

export function VersionHistoryPanel({
  open,
  onClose,
  versions,
  isLoading = false,
  currentVersionNumber,
  onRestore,
}: VersionHistoryPanelProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null)

  if (!open) return null

  async function handleRestore(version: VersionMeta) {
    const confirmed = window.confirm(
      `Restore to v${version.versionNumber}? This will overwrite the current canvas.`
    )
    if (!confirmed) return

    setRestoringId(version._id)
    try {
      await onRestore(version._id, version.versionNumber)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <aside
      className="fixed top-12 right-[400px] z-[55] flex h-[calc(100vh-3rem)] w-[300px] flex-col border-l border-white/10 bg-black/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md"
      aria-label="Version history"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
        <h2 className="text-sm font-medium text-white">Version History</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close version history"
        >
          <X className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-3">
          {isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-white/40">
              Loading versions…
            </p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-white/40">
              No versions yet — save your drawing to create the first version.
            </p>
          ) : (
            versions.map((version) => {
              const isCurrent = version.versionNumber === currentVersionNumber
              const isRestoring = restoringId === version._id

              return (
                <div
                  key={version._id}
                  className="group relative rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white">
                      v{version.versionNumber}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        Current
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        disabled={isRestoring}
                        onClick={() => handleRestore(version)}
                        className={cn(
                          'opacity-0 transition-opacity group-hover:opacity-100',
                          'bg-amber-500 text-white hover:bg-amber-400 border-0'
                        )}
                      >
                        {isRestoring ? 'Restoring…' : 'Restore'}
                      </Button>
                    )}
                  </div>

                  <p className="mb-1 text-sm text-white/90">{version.label}</p>
                  <p className="text-xs text-white/40">
                    {formatRelativeTime(version.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {version.elementCount} element
                    {version.elementCount === 1 ? '' : 's'}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
