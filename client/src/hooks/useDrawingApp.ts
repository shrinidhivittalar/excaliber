import { useCallback, useRef, useState } from 'react'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import axios from 'axios'
import * as api from '@/lib/api'
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

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.messages)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.messages)
    } catch {
      // ignore
    }
    return []
  }
}

function loadScene(): object {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scene)
    if (!raw) return EMPTY_SCENE

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.elements)) {
      localStorage.removeItem(STORAGE_KEYS.scene)
      return EMPTY_SCENE
    }

    return sanitizeScene(parsed)
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.scene)
    } catch {
      // ignore
    }
    return EMPTY_SCENE
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

export function useDrawingApp() {
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [sceneJson, setSceneJson] = useState<object>(loadScene)
  const [isLoading, setIsLoading] = useState(false)

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = api
  }, [])

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
    sendMessage,
    clearAll,
    setExcalidrawAPI,
    handleSceneChange,
  }
}
