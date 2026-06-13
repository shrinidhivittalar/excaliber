import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { CanvasTopBar }       from '@/components/CanvasTopBar'
import { HistoryDrawer }      from '@/components/HistoryDrawer'
import { CommandBar }         from '@/components/CommandBar'
import { NodePanel }          from '@/components/NodePanel'
import { VersionHistoryPanel } from '@/components/VersionHistoryPanel'
import { TooltipProvider }    from '@/components/ui/tooltip'
import { useAuth }            from '@/contexts/AuthContext'
import { hasLocalStorageDraft, useDrawingApp } from '@/hooks/useDrawingApp'
import { sanitizeAppState, sanitizeScene }     from '@/lib/scene'

const MIGRATION_HANDLED_KEY = 'ai-drawing-migration-handled'

function CanvasLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="mb-4 flex items-end gap-[5px]">
        {[0, 0.12, 0.24].map((delay, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-amber-400/60 wave-bar"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-white/40">Loading drawing…</p>
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
    autoCorrectEnabled,
    setAutoCorrectEnabled,
    lastCorrected,
    isCritiquing,
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
          if (newId) navigate(`/drawing/${newId}`, { replace: true })
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

  const [copied,      setCopied]      = useState(false)
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
  const hasElements        = Boolean(scene.elements && (scene.elements as unknown[]).length > 0)

  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        {showLoadingOverlay && <CanvasLoadingOverlay />}

        {/* Canvas — full screen, top bar floats over */}
        <div className="absolute inset-0">
          <style>{`
            .excalidraw .App-top-bar,
            .excalidraw header,
            .excalidraw .layer-ui__wrapper__top-left { display: none !important; }
          `}</style>
          <Excalidraw
            key={currentDrawingId ?? drawingIdFromUrl ?? 'new'}
            theme="dark"
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

        {/* Unified top bar */}
        <CanvasTopBar
          title={currentTitle || 'Untitled Drawing'}
          onTitleSave={(t) => { setCurrentTitle(t); void saveDrawing({ title: t }) }}
          folderName={currentFolderName}
          currentDrawingId={currentDrawingId}
          isSaving={isSaving}
          onSave={() => void saveDrawing()}
          onShare={() => void shareDrawing()}
          canUndo={canUndo}
          onUndo={undoLastAiAction}
          showHistoryToggle={messages.length > 0}
          historyOpen={historyOpen}
          onHistoryToggle={() => setHistoryOpen(v => !v)}
          copied={copied}
          onCopyPng={copyAsPng}
          autoCorrect={autoCorrectEnabled}
          onToggleAutoCorrect={() => setAutoCorrectEnabled(!autoCorrectEnabled)}
        />

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

        {isCritiquing && !lastCorrected && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                          pointer-events-none animate-slide-up">
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm
                            border border-white/8 rounded-full px-4 py-2">
              <div className="w-2.5 h-2.5 rounded-full border border-white/20
                              border-t-white/60 animate-spin" />
              <span className="text-[11px] text-white/40">Reviewing diagram…</span>
            </div>
          </div>
        )}

        {lastCorrected && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                          pointer-events-none animate-slide-up">
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm
                            border border-white/8 rounded-full px-4 py-2">
              <span className="text-[11px] text-emerald-400/70">✓ Auto-corrected</span>
            </div>
          </div>
        )}

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

        {/* Error toast — positioned below top bar */}
        {errorToast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200]
                          flex items-center gap-2
                          bg-red-950/90 border border-red-500/30
                          rounded-xl px-4 py-2.5 shadow-2xl animate-slide-up">
            <span className="text-xs text-red-200/90">{errorToast}</span>
            <button
              onClick={clearErrorToast}
              className="ml-1 text-xs leading-none text-red-400/60 transition-colors hover:text-red-300"
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

        {/* Empty canvas hint */}
        {!showLoadingOverlay && !isLoading && messages.length === 0 && !hasElements && (
          <div className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col items-center justify-center gap-3">
            <svg width="80" height="60" viewBox="0 0 80 60" fill="none"
                 className="mb-1 text-white/[0.07]">
              <rect x="4"  y="4"  width="30" height="18" rx="3"
                    stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
              <rect x="46" y="4"  width="30" height="18" rx="3"
                    stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
              <rect x="25" y="38" width="30" height="18" rx="3"
                    stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M19 22v5M61 22v5M19 27h21M61 27H40M40 27v11"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <p className="text-sm font-light tracking-wide text-white/[0.15]">
              Describe what to draw below
            </p>
            <p className="text-xs text-white/[0.08]">⌘K to focus</p>
          </div>
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
