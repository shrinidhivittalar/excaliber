import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import axios from 'axios'
import * as api from '@/lib/api'
import { drawingsApi } from '@/lib/api'
import { sanitizeAppState, sanitizeScene, prepareElementsForCanvas } from '@/lib/scene'
import type { Message } from '@/lib/types'

const STORAGE_KEYS = {
  messages: 'ai-drawing-messages',
  scene: 'ai-drawing-scene',
} as const

const CANVAS_ELEMENT_WARNING_THRESHOLD = 200

export const EMPTY_SCENE = {
  type: 'excalidraw',
  version: 2,
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
}

function saveToStorage(messages: Message[], sceneJson: object) {
  try {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages))
    localStorage.setItem(STORAGE_KEYS.scene, JSON.stringify(sanitizeScene(sceneJson)))
  } catch {
    // ignore quota or privacy errors
  }
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

function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.messages)
    localStorage.removeItem(STORAGE_KEYS.scene)
  } catch {
    // ignore
  }
}

export function useDrawingApp(drawingId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [sceneJson, setSceneJson] = useState<object>(EMPTY_SCENE)
  const [isLoading, setIsLoading] = useState(false)
  const [isCanvasLoading, setIsCanvasLoading] = useState(!!drawingId)

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initCanvas() {
      if (!drawingId) {
        setMessages([])
        setSceneJson(EMPTY_SCENE)
        clearLocalStorage()
        setIsCanvasLoading(false)
        applySceneToCanvas(excalidrawAPIRef.current, EMPTY_SCENE)
        return
      }

      setIsCanvasLoading(true)
      try {
        const { data } = await drawingsApi.get(drawingId)
        if (cancelled) return

        const loadedMessages = Array.isArray(data.conversationHistory)
          ? (data.conversationHistory as Message[])
          : []
        const loadedScene = sanitizeScene(data.sceneJson)

        setMessages(loadedMessages)
        setSceneJson(loadedScene)
        applySceneToCanvas(excalidrawAPIRef.current, loadedScene)
      } catch (error) {
        if (cancelled) return
        const errorContent =
          getNetworkErrorMessage(error) ??
          (axios.isAxiosError(error)
            ? ((error.response?.data as { error?: string })?.error ?? error.message)
            : 'Failed to load drawing')
        setMessages([createMessage('error', errorContent)])
        setSceneJson(EMPTY_SCENE)
      } finally {
        if (!cancelled) setIsCanvasLoading(false)
      }
    }

    initCanvas()
    return () => {
      cancelled = true
    }
  }, [drawingId])

  const setExcalidrawAPI = useCallback((excalidrawAPI: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = excalidrawAPI
    applySceneToCanvas(excalidrawAPI, sceneJson)
  }, [sceneJson])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMessage = createMessage('user', trimmed)
    let nextMessages = [...messages, userMessage]

    const scene = sceneJson as { elements?: unknown[] }
    if ((scene.elements?.length ?? 0) > CANVAS_ELEMENT_WARNING_THRESHOLD) {
      const warningMessage = createMessage(
        'assistant',
        'The canvas is getting full. Consider clearing it to start fresh.'
      )
      nextMessages = [...nextMessages, warningMessage]
    }

    setMessages(nextMessages)
    setIsLoading(true)
    saveToStorage(nextMessages, sceneJson)

    try {
      const data = await api.sendMessage(trimmed, nextMessages, sceneJson)
      const assistantMessage = createMessage('assistant', data.reply, data.toolsUsed)
      const updatedMessages = [...nextMessages, assistantMessage]

      setMessages(updatedMessages)
      const safeScene = sanitizeScene(data.sceneJson)
      setSceneJson(safeScene)
      try {
        applySceneToCanvas(excalidrawAPIRef.current, safeScene)
      } catch (canvasError) {
        console.error('Canvas update failed:', canvasError)
      }
      saveToStorage(updatedMessages, safeScene)
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
      saveToStorage(updatedMessages, sceneJson)
    } finally {
      setIsLoading(false)
    }
  }, [messages, sceneJson])

  const clearAll = useCallback(async () => {
    try {
      const data = await api.clearCanvas()
      const emptyScene = data.sceneJson ?? EMPTY_SCENE

      setMessages([])
      setSceneJson(emptyScene)
      applySceneToCanvas(excalidrawAPIRef.current, emptyScene)
      try {
        localStorage.removeItem(STORAGE_KEYS.messages)
        localStorage.removeItem(STORAGE_KEYS.scene)
      } catch {
        // ignore
      }
    } catch (error) {
      const errorContent =
        getNetworkErrorMessage(error) ??
        (error instanceof Error ? error.message : 'Failed to clear canvas')
      const errorMessage = createMessage('error', errorContent)
      const updatedMessages = [...messages, errorMessage]

      setMessages(updatedMessages)
      saveToStorage(updatedMessages, sceneJson)
    }
  }, [messages, sceneJson])

  const handleSceneChange = useCallback(
    (elements: readonly unknown[], appState: AppState) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        const updatedScene = sanitizeScene({
          type: 'excalidraw',
          version: 2,
          elements: [...elements],
          appState,
        })

        setSceneJson(updatedScene)
        saveToStorage(messages, updatedScene)
      }, 1000)
    },
    [messages]
  )

  return {
    messages,
    sceneJson,
    isLoading,
    isCanvasLoading,
    drawingId,
    sendMessage,
    clearAll,
    setExcalidrawAPI,
    handleSceneChange,
  }
}
