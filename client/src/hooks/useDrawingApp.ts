import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import axios from 'axios'
import * as api from '@/lib/api'
import { drawingsApi } from '@/lib/api'
import { sanitizeAppState, sanitizeScene, prepareElementsForCanvas } from '@/lib/scene'
import type { DrawingFull, Message } from '@/lib/types'

const STORAGE_KEYS = {
  messages: 'ai-drawing-messages',
  scene: 'ai-drawing-scene',
} as const

const CANVAS_ELEMENT_WARNING_THRESHOLD = 200
const SCENE_DEBOUNCE_MS = 1000
const AUTO_SAVE_DEBOUNCE_MS = 3000

export const EMPTY_SCENE = {
  type: 'excalidraw',
  version: 2,
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
}

function createMessage(
  role: Message['role'],
  content: string,
  toolsUsed?: string[]
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    toolsUsed,
    timestamp: Date.now(),
  }
}

function getNetworkErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null

  if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
    return 'Connection lost — your canvas is safe, try again'
  }

  const status = error.response?.status
  if (status === 503) {
    return 'Drawing service is starting up — try again in a moment'
  }
  if (status === 429) {
    return 'Too many requests — wait a moment and try again'
  }

  return null
}

function applySceneToCanvas(excalidrawAPI: ExcalidrawImperativeAPI | null, sceneJson: object) {
  if (!excalidrawAPI) return

  const scene = sceneJson as {
    elements?: unknown[]
    appState?: Record<string, unknown>
  }

  const elements = prepareElementsForCanvas(scene.elements ?? [])

  excalidrawAPI.updateScene({
    elements: elements as never[],
    appState: sanitizeAppState(scene.appState) as never,
  })

  try {
    excalidrawAPI.scrollToContent(undefined, { fitToContent: true })
  } catch (error) {
    console.warn('scrollToContent failed:', error)
  }
}

function saveToStorage(messages: Message[], sceneJson: object) {
  try {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages))
    localStorage.setItem(STORAGE_KEYS.scene, JSON.stringify(sanitizeScene(sceneJson)))
  } catch {
    // ignore quota or privacy errors
  }
}

function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.messages)
    localStorage.removeItem(STORAGE_KEYS.scene)
  } catch {
    // ignore
  }
}

function loadMessagesFromStorage(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.messages)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadSceneFromStorage(): object | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scene)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.elements)) {
      return null
    }
    if (parsed.elements.length === 0) return null
    return sanitizeScene(parsed)
  } catch {
    return null
  }
}

export function hasLocalStorageDraft(): boolean {
  return loadSceneFromStorage() !== null
}

export function useDrawingApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sceneJson, setSceneJson] = useState<object>(EMPTY_SCENE)
  const [isLoading, setIsLoading] = useState(false)
  const [isCanvasLoading, setIsCanvasLoading] = useState(false)
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('Untitled Drawing')
  const [isSaving, setIsSaving] = useState(false)

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const sceneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesRef = useRef(messages)
  const sceneJsonRef = useRef(sceneJson)
  const currentDrawingIdRef = useRef(currentDrawingId)
  const currentTitleRef = useRef(currentTitle)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sceneJsonRef.current = sceneJson
  }, [sceneJson])

  useEffect(() => {
    currentDrawingIdRef.current = currentDrawingId
  }, [currentDrawingId])

  useEffect(() => {
    currentTitleRef.current = currentTitle
  }, [currentTitle])

  const loadDrawing = useCallback(async (id: string) => {
    setIsCanvasLoading(true)
    try {
      const { data } = await drawingsApi.get(id)
      const drawing = data as DrawingFull

      const loadedMessages = Array.isArray(drawing.conversationHistory)
        ? drawing.conversationHistory
        : []
      const loadedScene = sanitizeScene(drawing.sceneJson)

      setMessages(loadedMessages)
      setSceneJson(loadedScene)
      setCurrentDrawingId(drawing._id)
      setCurrentTitle(drawing.title ?? 'Untitled Drawing')
      applySceneToCanvas(excalidrawAPIRef.current, loadedScene)
      clearLocalStorage()
    } catch (error) {
      const errorContent =
        getNetworkErrorMessage(error) ??
        (axios.isAxiosError(error)
          ? ((error.response?.data as { error?: string })?.error ?? error.message)
          : 'Failed to load drawing')
      setMessages([createMessage('error', errorContent)])
      setSceneJson(EMPTY_SCENE)
      setCurrentDrawingId(null)
      setCurrentTitle('Untitled Drawing')
    } finally {
      setIsCanvasLoading(false)
    }
  }, [])

  const importLocalStorageDraft = useCallback(() => {
    const storedScene = loadSceneFromStorage()
    const storedMessages = loadMessagesFromStorage()
    if (!storedScene) return false

    messagesRef.current = storedMessages
    sceneJsonRef.current = storedScene
    setMessages(storedMessages)
    setSceneJson(storedScene)
    setCurrentDrawingId(null)
    setCurrentTitle('Untitled Drawing')
    applySceneToCanvas(excalidrawAPIRef.current, storedScene)
    return true
  }, [])

  const resetFreshCanvas = useCallback(() => {
    setCurrentDrawingId(null)
    setCurrentTitle('Untitled Drawing')
    setMessages([])
    setSceneJson(EMPTY_SCENE)
    clearLocalStorage()
    setIsCanvasLoading(false)
    applySceneToCanvas(excalidrawAPIRef.current, EMPTY_SCENE)
  }, [])

  const saveDrawing = useCallback(
    async (title?: string, options?: { silent?: boolean }) => {
      const nextTitle = title ?? currentTitleRef.current
      const silent = options?.silent ?? false

      if (!silent) setIsSaving(true)
      try {
        const payload = {
          title: nextTitle,
          sceneJson: sceneJsonRef.current,
          conversationHistory: messagesRef.current,
        }

        if (currentDrawingIdRef.current) {
          await drawingsApi.update(currentDrawingIdRef.current, payload)
          setCurrentTitle(nextTitle)
          return currentDrawingIdRef.current
        }

        const { data } = await drawingsApi.create(payload)
        const drawing = data as DrawingFull
        setCurrentDrawingId(drawing._id)
        setCurrentTitle(drawing.title ?? nextTitle)
        clearLocalStorage()
        return drawing._id
      } finally {
        if (!silent) setIsSaving(false)
      }
    },
    []
  )

  const autoSaveDrawing = useCallback(
    async (updatedScene: object) => {
      const drawingId = currentDrawingIdRef.current
      if (!drawingId) return

      try {
        await drawingsApi.update(drawingId, {
          title: currentTitleRef.current,
          sceneJson: updatedScene,
          conversationHistory: messagesRef.current,
        })
      } catch (error) {
        console.warn('Auto-save failed:', error)
      }
    },
    []
  )

  const shareDrawing = useCallback(async (): Promise<{
    url: string
    drawingId: string
  } | null> => {
    let drawingId = currentDrawingIdRef.current
    if (!drawingId) {
      drawingId = (await saveDrawing()) ?? null
    }
    if (!drawingId) return null

    const { data } = await drawingsApi.share(drawingId)
    if (!data.shareId) return null

    const url = `${window.location.origin}/share/${data.shareId}`
    await navigator.clipboard.writeText(url)
    return { url, drawingId }
  }, [saveDrawing])

  const setExcalidrawAPI = useCallback(
    (excalidrawAPI: ExcalidrawImperativeAPI) => {
      excalidrawAPIRef.current = excalidrawAPI
      applySceneToCanvas(excalidrawAPI, sceneJsonRef.current)
    },
    []
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const userMessage = createMessage('user', trimmed)
      let nextMessages = [...messagesRef.current, userMessage]

      const scene = sceneJsonRef.current as { elements?: unknown[] }
      if ((scene.elements?.length ?? 0) > CANVAS_ELEMENT_WARNING_THRESHOLD) {
        const warningMessage = createMessage(
          'assistant',
          'The canvas is getting full. Consider clearing it to start fresh.'
        )
        nextMessages = [...nextMessages, warningMessage]
      }

      setMessages(nextMessages)
      setIsLoading(true)
      saveToStorage(nextMessages, sceneJsonRef.current)

      try {
        const data = await api.sendMessage(trimmed, nextMessages, sceneJsonRef.current)
        const assistantMessage = createMessage('assistant', data.reply, data.toolsUsed)
        const updatedMessages = [...nextMessages, assistantMessage]

        setMessages(updatedMessages)
        let safeScene = sanitizeScene(data.sceneJson)

        if (data.mermaidDiagram) {
          try {
            const { elements } = await parseMermaidToExcalidraw(data.mermaidDiagram)
            const mermaidScene = sanitizeScene({
              type: 'excalidraw',
              version: 2,
              elements,
              appState: {},
            })
            safeScene = mermaidScene
          } catch {
            // Fall back to normal sceneJson
          }
        }

        setSceneJson(safeScene)
        saveToStorage(updatedMessages, safeScene)
        try {
          applySceneToCanvas(excalidrawAPIRef.current, safeScene)
        } catch (canvasError) {
          console.error('Canvas update failed:', canvasError)
        }

        if (currentDrawingIdRef.current) {
          void autoSaveDrawing(safeScene)
        }
      } catch (error) {
        let errorContent = getNetworkErrorMessage(error) ?? 'Something went wrong'

        if (errorContent === 'Something went wrong' && axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            errorContent = 'This is taking too long — try a simpler request'
          } else {
            const responseError = error.response?.data as { error?: string } | undefined
            errorContent = responseError?.error ?? error.message
          }
        } else if (errorContent === 'Something went wrong' && error instanceof Error) {
          errorContent = error.message
        }

        const errorMessage = createMessage('error', errorContent)
        const updatedMessages = [...nextMessages, errorMessage]
        setMessages(updatedMessages)
        saveToStorage(updatedMessages, sceneJsonRef.current)
      } finally {
        setIsLoading(false)
      }
    },
    [autoSaveDrawing]
  )

  const clearAll = useCallback(async () => {
    try {
      const data = await api.clearCanvas()
      const emptyScene = data.sceneJson ?? EMPTY_SCENE

      setMessages([])
      setSceneJson(emptyScene)
      applySceneToCanvas(excalidrawAPIRef.current, emptyScene)
      clearLocalStorage()
    } catch (error) {
      const errorContent =
        getNetworkErrorMessage(error) ??
        (error instanceof Error ? error.message : 'Failed to clear canvas')
      const errorMessage = createMessage('error', errorContent)
      setMessages((prev) => [...prev, errorMessage])
    }
  }, [])

  const handleSceneChange = useCallback(
    (elements: readonly unknown[], appState: AppState) => {
      if (sceneDebounceRef.current) {
        clearTimeout(sceneDebounceRef.current)
      }
      if (autoSaveDebounceRef.current) {
        clearTimeout(autoSaveDebounceRef.current)
      }

      sceneDebounceRef.current = setTimeout(() => {
        const updatedScene = sanitizeScene({
          type: 'excalidraw',
          version: 2,
          elements: [...elements],
          appState,
        })
        setSceneJson(updatedScene)
        saveToStorage(messagesRef.current, updatedScene)

        if (currentDrawingIdRef.current) {
          autoSaveDebounceRef.current = setTimeout(() => {
            void autoSaveDrawing(updatedScene)
          }, AUTO_SAVE_DEBOUNCE_MS)
        }
      }, SCENE_DEBOUNCE_MS)
    },
    [autoSaveDrawing]
  )

  return {
    messages,
    sceneJson,
    isLoading,
    isCanvasLoading,
    currentDrawingId,
    currentTitle,
    isSaving,
    sendMessage,
    clearAll,
    saveDrawing,
    shareDrawing,
    loadDrawing,
    resetFreshCanvas,
    importLocalStorageDraft,
    setCurrentTitle,
    setExcalidrawAPI,
    handleSceneChange,
  }
}
