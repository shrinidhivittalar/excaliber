import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { HelpCircle } from 'lucide-react'
import { CanvasTitle }    from '@/components/CanvasTitle'
import { CanvasActions }  from '@/components/CanvasActions'
import { HistoryDrawer }  from '@/components/HistoryDrawer'
import { CommandBar } from '@/components/CommandBar'
import { NodePanel } from '@/components/NodePanel'
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
    sceneJson,
    isCanvasLoading,
    currentDrawingId,
    currentTitle,
    currentFolderName,
    currentTags,
    sendMessage,
    isLoading,
    loadingStage,
    messages,
    isSaving,
    saveDrawing,
    shareDrawing,
    setCurrentTitle,
    loadDrawing,
    resetFreshCanvas,
    importLocalStorageDraft,
    setExcalidrawAPI,
    handleSceneChange,
    showVersionHistory,
    toggleVersionHistory,
    versions,
    versionsLoading,
    restoreVersion,
    currentVersionNumber,
    versionToast,
    excalidrawAPIRef,
    selectedNode,
    clearSelectedNode,
    ingestDocument,
    canUndo,
    undoLastAiAction,
    errorToast,
    clearErrorToast,
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

  const [copied, setCopied]           = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void saveDrawing()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveDrawing])

  async function copyAsPng() {
    const api = excalidrawAPIRef.current
    if (!api) return
    try {
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true },
        files:    api.getFiles(),
        mimeType: 'image/png',
      })
      if (!navigator.clipboard?.write) {
        console.warn('[COPY PNG] clipboard.write API not available (requires HTTPS or localhost)')
        return
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('[COPY PNG]', err)
    }
  }

  const showLoadingOverlay = Boolean(drawingIdFromUrl && isCanvasLoading)

  return (
    <TooltipProvider>
      <div className="w-screen h-screen overflow-hidden relative">
        {showLoadingOverlay && <CanvasLoadingOverlay />}

        <div className="absolute inset-0">
          <style>{`
            .excalidraw .App-top-bar,
            .excalidraw header,
            .excalidraw .layer-ui__wrapper__top-left { display: none !important; }
          `}</style>
          <Excalidraw
            key={currentDrawingId ?? drawingIdFromUrl ?? 'new'}
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            initialData={{
              elements: (scene.elements ?? []) as never[],
              appState: sanitizeAppState(scene.appState),
            }}
            onChange={(elements, appState) => handleSceneChange(elements, appState)}
            UIOptions={{
              canvasActions: {
                export: false,
                saveAsImage: false,
                loadScene: false,
                clearCanvas: false,
                changeViewBackgroundColor: false,
                toggleTheme: false,
              },
            }}
          />
        </div>

        <CanvasTitle
          title={currentTitle || 'Untitled Drawing'}
          onSave={(t) => { setCurrentTitle(t); void saveDrawing({ title: t }) }}
        />

        <CanvasActions
          onSave={() => void saveDrawing()}
          onShare={() => void shareDrawing()}
          isSaving={isSaving}
          currentDrawingId={currentDrawingId}
          showHistoryToggle={messages.length > 0}
          historyOpen={historyOpen}
          onHistoryToggle={() => setHistoryOpen(v => !v)}
          canUndo={canUndo}
          onUndo={undoLastAiAction}
        />

        <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
          <Link
            to="/dashboard"
            className="text-xs text-white/35 hover:text-white/60 transition-colors bg-black/50 border border-white/8 rounded-lg px-2.5 py-1.5 backdrop-blur-sm"
          >
            ← Dashboard
          </Link>

          <button
            onClick={copyAsPng}
            title="Copy canvas as PNG"
            className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5 transition-all duration-150"
          >
            {copied ? '✓ Copied' : '⬡ Copy PNG'}
          </button>
        </div>

        <HistoryDrawer
          messages={messages}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />

        <CommandBar
          isLoading={isLoading}
          loadingStage={loadingStage}
          onSubmit={sendMessage}
          onIngest={ingestDocument}
        />

        {selectedNode && (
          <NodePanel
            node={selectedNode}
            onExplain={(label) =>
              sendMessage(`Explain "${label}" in the context of this diagram.`)
            }
            onDrillDown={(label) =>
              sendMessage(`Create a detailed diagram expanding on "${label}".`)
            }
            onClose={clearSelectedNode}
          />
        )}

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

        {/* Empty canvas first-run hint */}
        {!showLoadingOverlay && !isLoading && messages.length === 0 &&
          !(scene.elements && (scene.elements as unknown[]).length > 0) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center
                          justify-center z-10 select-none">
            <p className="text-white/10 text-sm font-light tracking-wide">
              Describe what to draw below ↓
            </p>
          </div>
        )}

        {/* Error toast */}
        {errorToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]
                          flex items-center gap-2
                          bg-red-950/90 border border-red-500/30
                          rounded-xl px-4 py-2.5 shadow-2xl animate-slide-up">
            <span className="text-xs text-red-200/90">{errorToast}</span>
            <button
              onClick={clearErrorToast}
              className="text-red-400/60 hover:text-red-300 text-xs leading-none ml-1 transition-colors"
            >
              ✕
            </button>
          </div>
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
              <div className="fixed bottom-24 right-4 z-[60] rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 shadow-lg">
                {versionToast}
              </div>
            )}
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
