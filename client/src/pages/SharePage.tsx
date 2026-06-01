import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Button } from '@/components/ui/button'
import { shareApi } from '@/lib/api'
import { sanitizeAppState, sanitizeScene } from '@/lib/scene'

export default function SharePage() {
  const { shareId } = useParams()
  const id = Array.isArray(shareId) ? shareId[0] : shareId

  const [title, setTitle] = useState<string | null>(null)
  const [sceneJson, setSceneJson] = useState<object | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) {
      setError(true)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(false)
      try {
        const { data } = await shareApi.get(id)
        if (cancelled) return
        setTitle(data.title ?? 'Untitled Drawing')
        setSceneJson(sanitizeScene(data.sceneJson))
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white/40">
        Loading shared drawing…
      </div>
    )
  }

  if (error || !sceneJson) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center">
        <p className="text-white/60">
          This drawing is not available or is no longer shared.
        </p>
        <Button asChild className="bg-white text-black hover:bg-white/90">
          <Link to="/login">Create your own</Link>
        </Button>
      </div>
    )
  }

  const scene = sceneJson as {
    elements?: unknown[]
    appState?: Record<string, unknown>
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3">
        <h1 className="truncate text-lg font-medium text-black">{title}</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/login">Create your own</Link>
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <Excalidraw
          initialData={{
            elements: (scene.elements ?? []) as never[],
            appState: sanitizeAppState(scene.appState),
          }}
          viewModeEnabled
          UIOptions={{ canvasActions: { export: false } }}
        />
      </div>
    </div>
  )
}
