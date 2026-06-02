import { cn } from '@/lib/utils'

interface DrawingInfoBarProps {
  title: string
  folderName: string | null
  tags: string[]
}

export function DrawingInfoBar({ title, folderName, tags }: DrawingInfoBarProps) {
  const visibleTags = tags.slice(0, 3)
  const moreCount = tags.length - visibleTags.length

  return (
    <div
      className={cn(
        'absolute top-2 left-1/2 z-40 flex max-w-[min(90vw,640px)] -translate-x-1/2',
        'items-center justify-between gap-4 rounded-full bg-black/60 px-4 py-1',
        'text-xs text-white/50 backdrop-blur-sm'
      )}
    >
      <span className="truncate">
        {folderName ? (
          <>
            <span aria-hidden>📁 </span>
            {folderName} › {title}
          </>
        ) : (
          title
        )}
      </span>

      {tags.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60"
            >
              {tag}
            </span>
          ))}
          {moreCount > 0 && (
            <span className="text-[10px] text-white/40">+{moreCount} more</span>
          )}
        </div>
      )}
    </div>
  )
}
