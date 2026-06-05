import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { HelpCircle } from 'lucide-react'
import { ChatPanel } from '@/components/ChatPanel'
import { DrawingInfoBar } from '@/components/DrawingInfoBar'
import { VersionHistoryPanel } from '@/components/VersionHistoryPanel'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/AuthContext'
import { hasLocalStorageDraft, useDrawingApp } from '@/hooks/useDrawingApp'
import { sanitizeAppState, sanitizeScene } from '@/lib/scene'

const MIGRATION_HANDLED_KEY = 'ai-drawing-migration-handled'

function CanvasLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <p className="text-sm text-white/70">
        Loading drawing
        <span className="loading-dots ml-0.5 inline-flex">
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
        </span>
      </p>
    </div>
  )
}

export default function CanvasPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const drawingIdFromUrl = Array.isArray(id) ? id[0] : id
  const { isAuthenticated } = useAuth()
  const migrationCheckedRef = useRef(false)

  const {
    messages,
    sceneJson,
    isLoading,
    isCanvasLoading,
    currentDrawingId,
    currentTitle,
    currentFolderName,
    currentTags,
    isSaving,
    sendMessage,
    retryLastMessage,
    clearAll,
    saveDrawing,
    shareDrawing,
    loadDrawing,
    resetFreshCanvas,
    importLocalStorageDraft,
    setCurrentTitle,
    setExcalidrawAPI,
    handleSceneChange,
    showVersionHistory,
    toggleVersionHistory,
    versions,
    versionsLoading,
    restoreVersion,
    currentVersionNumber,
    versionToast,
  } = useDrawingApp()

  useEffect(() => {
    if (drawingIdFromUrl) {
      void loadDrawing(drawingIdFromUrl)
    }
  }, [drawingIdFromUrl, loadDrawing])

  useEffect(() => {
    if (drawingIdFromUrl || !isAuthenticated || migrationCheckedRef.current) return

    migrationCheckedRef.current = true

    const alreadyHandled = sessionStorage.getItem(MIGRATION_HANDLED_KEY) === 'true'
    const hasDraft = hasLocalStorageDraft()

    if (hasDraft && !alreadyHandled) {
      const accept = window.confirm(
        'You have an unsaved canvas — would you like to save it to your account?'
      )
      sessionStorage.setItem(MIGRATION_HANDLED_KEY, 'true')

      if (accept) {
        importLocalStorageDraft()
        void (async () => {
          const newId = await saveDrawing({ title: 'Recovered Drawing' })
          if (newId) {
            navigate(`/drawing/${newId}`, { replace: true })
          }
        })()
        return
      }

      clearLocalStorageDraft()
    }

    resetFreshCanvas()
  }, [
    drawingIdFromUrl,
    isAuthenticated,
    importLocalStorageDraft,
    saveDrawing,
    resetFreshCanvas,
    navigate,
  ])

  const scene = sanitizeScene(sceneJson) as {
    elements?: unknown[]
    appState?: Record<string, unknown>
  }

  const handleSave = async (options?: {
    title?: string
    folderId?: string | null
    tags?: string[]
  }) => {
    const newId = await saveDrawing(options)
    if (newId && !drawingIdFromUrl) {
      navigate(`/drawing/${newId}`, { replace: true })
    }
  }

  const handleTitleChange = async (title: string) => {
    setCurrentTitle(title)
    if (currentDrawingId) {
      await saveDrawing({ title })
    }
  }

  const handleShare = async () => {
    const result = await shareDrawing()
    if (result && !drawingIdFromUrl) {
      navigate(`/drawing/${result.drawingId}`, { replace: true })
    }
    return result?.url ?? null
  }

  const showLoadingOverlay = Boolean(drawingIdFromUrl && isCanvasLoading)

  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-white">
        {showLoadingOverlay && <CanvasLoadingOverlay />}

        <Link
          to="/dashboard"
          className="absolute left-3 top-3 z-40 text-xs text-black/30 transition-colors hover:text-black/50"
        >
          ← Dashboard
        </Link>

        <Excalidraw
          key={currentDrawingId ?? drawingIdFromUrl ?? 'new'}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: (scene.elements ?? []) as never[],
            appState: sanitizeAppState(scene.appState),
          }}
          onChange={(elements, appState) => handleSceneChange(elements, appState)}
          UIOptions={{ canvasActions: { export: {} } }}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="absolute left-[calc(50%+180px)] top-3 z-40 flex size-6 items-center justify-center rounded-full border border-black/10 bg-white/90 text-black/50 shadow-sm transition-colors hover:bg-white hover:text-black/70"
              aria-label="Canvas editing help"
            >
              <HelpCircle className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-center">
            You can also manually edit the canvas — changes are saved automatically
          </TooltipContent>
        </Tooltip>

        {!showLoadingOverlay && currentDrawingId && (
          <DrawingInfoBar
            title={currentTitle}
            folderName={currentFolderName}
            tags={currentTags}
          />
        )}

        {!showLoadingOverlay && (
          <>
            <VersionHistoryPanel
              open={showVersionHistory}
              onClose={() => toggleVersionHistory()}
              versions={versions}
              isLoading={versionsLoading}
              currentVersionNumber={currentVersionNumber}
              onRestore={restoreVersion}
            />

            {versionToast && (
              <div className="fixed bottom-24 right-[400px] z-[60] rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 shadow-lg">
                {versionToast}
              </div>
            )}

            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={sendMessage}
              onClear={clearAll}
              onSave={handleSave}
              onShare={handleShare}
              isSaving={isSaving}
              currentTitle={currentTitle}
              onTitleChange={handleTitleChange}
              currentDrawingId={currentDrawingId}
              showVersionHistory={showVersionHistory}
              onToggleVersionHistory={toggleVersionHistory}
              onRetry={retryLastMessage}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

function clearLocalStorageDraft() {
  try {
    localStorage.removeItem('ai-drawing-messages')
    localStorage.removeItem('ai-drawing-scene')
  } catch {
    // ignore
  }
}
