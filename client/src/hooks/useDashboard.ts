import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { drawingsApi } from '@/lib/api'
import type { DrawingMeta } from '@/lib/types'

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    return data?.error ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Failed to load drawings'
}

export function useDashboard() {
  const [drawings, setDrawings] = useState<DrawingMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDrawings() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await drawingsApi.list()
        setDrawings(data as DrawingMeta[])
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    fetchDrawings()
  }, [])

  const deleteDrawing = useCallback(async (id: string) => {
    await drawingsApi.delete(id)
    setDrawings((prev) => prev.filter((d) => d._id !== id))
  }, [])

  const updateTitle = useCallback(async (id: string, title: string) => {
    await drawingsApi.update(id, { title })
    setDrawings((prev) =>
      prev.map((d) => (d._id === id ? { ...d, title } : d))
    )
  }, [])

  return {
    drawings,
    isLoading,
    error,
    deleteDrawing,
    updateTitle,
  }
}
