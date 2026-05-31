import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { HelpCircle } from 'lucide-react'
import { ChatPanel } from '@/components/ChatPanel'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDrawingApp } from '@/hooks/useDrawingApp'
import { sanitizeAppState, sanitizeScene } from '@/lib/scene'

function App() {
  const {
    messages,
    sceneJson,
    isLoading,
    sendMessage,
    clearAll,
    setExcalidrawAPI,
    handleSceneChange,
  } = useDrawingApp()

  const scene = sanitizeScene(sceneJson) as {
    elements?: unknown[]
    appState?: Record<string, unknown>
  }

  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-white">
        <Excalidraw
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

        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onClear={clearAll}
        />
      </div>
    </TooltipProvider>
  )
}

export default App
