import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { drawingsApi, foldersApi } from '@/lib/api'
import type { DrawingMeta, Folder } from '@/lib/types'

export type FolderFilter = 'all' | null | string
export type ViewMode = 'grid' | 'list'

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    return data?.error ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Failed to load dashboard'
}

function normalizeDrawing(drawing: DrawingMeta): DrawingMeta {
  return {
    ...drawing,
    tags: Array.isArray(drawing.tags) ? drawing.tags : [],
  }
}

export function useDashboard() {
  const [drawings, setDrawings] = useState<DrawingMeta[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<FolderFilter>('all')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [drawingsRes, foldersRes] = await Promise.all([
        drawingsApi.list(),
        foldersApi.list(),
      ])
      setDrawings(
        (drawingsRes.data as DrawingMeta[]).map(normalizeDrawing)
      )
      setFolders(foldersRes.data as Folder[])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const drawing of drawings) {
      for (const tag of drawing.tags) {
        const trimmed = tag.trim()
        if (trimmed) tagSet.add(trimmed)
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  }, [drawings])

  const filteredDrawings = useMemo(() => {
    let result = drawings

    if (selectedFolderId !== 'all') {
      if (selectedFolderId === null) {
        result = result.filter((d) => !d.folderId)
      } else {
        result = result.filter((d) => d.folderId === selectedFolderId)
      }
    }

    if (activeTags.length > 0) {
      result = result.filter((d) =>
        activeTags.every((tag) =>
          d.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
        )
      )
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    return result
  }, [drawings, selectedFolderId, activeTags, searchQuery])

  const unfolderedCount = useMemo(
    () => drawings.filter((d) => !d.folderId).length,
    [drawings]
  )

  const hasActiveFilters =
    selectedFolderId !== 'all' ||
    activeTags.length > 0 ||
    searchQuery.trim().length > 0

  const createFolder = useCallback(async (name: string, color?: string) => {
    const { data } = await foldersApi.create({ name, color })
    const folder = data as Folder
    setFolders((prev) =>
      [...prev, { ...folder, drawingCount: folder.drawingCount ?? 0 }].sort(
        (a, b) => a.name.localeCompare(b.name)
      )
    )
    return folder
  }, [])

  const updateFolder = useCallback(
    async (id: string, data: { name?: string; color?: string }) => {
      const { data: updated } = await foldersApi.update(id, data)
      const folder = updated as Folder
      setFolders((prev) =>
        prev
          .map((f) => (f._id === id ? { ...f, ...folder } : f))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    },
    []
  )

  const deleteFolder = useCallback(async (id: string) => {
    await foldersApi.delete(id)
    setFolders((prev) => prev.filter((f) => f._id !== id))
    setDrawings((prev) =>
      prev.map((d) => (d.folderId === id ? { ...d, folderId: null } : d))
    )
    if (selectedFolderId === id) {
      setSelectedFolderId('all')
    }
  }, [selectedFolderId])

  const syncFolderCounts = useCallback((nextDrawings: DrawingMeta[]) => {
    setFolders((prev) =>
      prev.map((folder) => ({
        ...folder,
        drawingCount: nextDrawings.filter((d) => d.folderId === folder._id).length,
      }))
    )
  }, [])

  const moveDrawing = useCallback(
    async (drawingId: string, folderId: string | null) => {
      await drawingsApi.update(drawingId, { folderId })
      setDrawings((prev) => {
        const next = prev.map((d) =>
          d._id === drawingId ? { ...d, folderId } : d
        )
        syncFolderCounts(next)
        return next
      })
    },
    [syncFolderCounts]
  )

  const updateTags = useCallback(async (drawingId: string, tags: string[]) => {
    await drawingsApi.update(drawingId, { tags })
    setDrawings((prev) =>
      prev.map((d) => (d._id === drawingId ? { ...d, tags } : d))
    )
  }, [])

  const deleteDrawing = useCallback(
    async (id: string) => {
      await drawingsApi.delete(id)
      setDrawings((prev) => {
        const next = prev.filter((d) => d._id !== id)
        syncFolderCounts(next)
        return next
      })
    },
    [syncFolderCounts]
  )

  const updateTitle = useCallback(async (id: string, title: string) => {
    await drawingsApi.update(id, { title })
    setDrawings((prev) =>
      prev.map((d) => (d._id === id ? { ...d, title } : d))
    )
  }, [])

  const setSearch = useCallback((q: string) => {
    setSearchQuery(q)
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag]
    )
  }, [])

  const setFolderFilter = useCallback((id: FolderFilter) => {
    setSelectedFolderId(id)
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedFolderId('all')
    setActiveTags([])
    setSearchQuery('')
  }, [])

  return {
    drawings,
    folders,
    filteredDrawings,
    allTags,
    selectedFolderId,
    activeTags,
    searchQuery,
    viewMode,
    isLoading,
    error,
    unfolderedCount,
    hasActiveFilters,
    fetchAll,
    createFolder,
    updateFolder,
    deleteFolder,
    moveDrawing,
    updateTags,
    deleteDrawing,
    updateTitle,
    setSearch,
    toggleTag,
    setFolderFilter,
    clearFilters,
    setViewMode,
  }
}
