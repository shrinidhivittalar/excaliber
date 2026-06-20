import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { exportToBlob } from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import axios from 'axios'
import * as api from '@/lib/api'
import { drawingsApi, foldersApi, versionsApi, ingestApi, critiqueApi } from '@/lib/api'
import type { ClientSemanticState } from '@/lib/api'
import { detectIntent } from '../lib/detectIntent'
import { sanitizeAppState, sanitizeScene, prepareElementsForCanvas } from '@/lib/scene'
import type { DrawingFull, Folder, Message, VersionMeta } from '@/lib/types'
import type { SelectedNode } from '../components/NodePanel'

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

export interface SaveDrawingOptions {
  title?: string
  folderId?: string | null
  tags?: string[]
  silent?: boolean
}

export function useDrawingApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sceneJson, setSceneJson] = useState<object>(EMPTY_SCENE)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<string>('Thinking...')
  const [theme, setTheme] = useState<'minimal' | 'default' | 'vibrant'>(() => {
    return (localStorage.getItem('ai-drawing-theme') as 'minimal' | 'default' | 'vibrant') ?? 'default'
  })
  const [isCanvasLoading, setIsCanvasLoading] = useState(false)
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('Untitled Drawing')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentFolderName, setCurrentFolderName] = useState<string | null>(null)
  const [currentTags, setCurrentTags] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionToast, setVersionToast] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState<boolean>(() =>
    localStorage.getItem('ai-drawing-autocorrect') !== 'false'
  )
  const [lastCorrected, setLastCorrected] = useState(false)
  const [isCritiquing, setIsCritiquing] = useState(false)
  const [detectedIntent, setDetectedIntent] = useState('')
  const [semanticState, setSemanticState] = useState<ClientSemanticState | undefined>(undefined)

  const prevSceneRef = useRef<object | null>(null)
  const themeRef = useRef(theme)
  const autoCorrectRef = useRef(autoCorrectEnabled)

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const sceneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesRef = useRef(messages)
  const sceneJsonRef = useRef(sceneJson)
  const semanticStateRef = useRef<ClientSemanticState | undefined>(undefined)
  const currentDrawingIdRef = useRef(currentDrawingId)
  const currentTitleRef = useRef(currentTitle)
  const currentFolderIdRef = useRef(currentFolderId)
  const currentTagsRef = useRef(currentTags)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sceneJsonRef.current = sceneJson
  }, [sceneJson])

  useEffect(() => {
    semanticStateRef.current = semanticState
  }, [semanticState])

  useEffect(() => {
    currentDrawingIdRef.current = currentDrawingId
  }, [currentDrawingId])

  useEffect(() => {
    currentTitleRef.current = currentTitle
  }, [currentTitle])

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId
  }, [currentFolderId])

  useEffect(() => {
    currentTagsRef.current = currentTags
  }, [currentTags])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    autoCorrectRef.current = autoCorrectEnabled
  }, [autoCorrectEnabled])

  useEffect(() => {
    if (!errorToast) return
    const t = setTimeout(() => setErrorToast(null), 5000)
    return () => clearTimeout(t)
  }, [errorToast])

  const loadVersions = useCallback(async (drawingId?: string) => {
    const id = drawingId ?? currentDrawingIdRef.current
    if (!id) {
      setVersions([])
      return
    }

    setVersionsLoading(true)
    try {
      const { data } = await versionsApi.list(id)
      setVersions(data as VersionMeta[])
    } catch (error) {
      console.warn('Failed to load versions:', error)
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentDrawingId) {
      void loadVersions()
    } else {
      setVersions([])
      setShowVersionHistory(false)
    }
  }, [currentDrawingId, loadVersions])

  const toggleVersionHistory = useCallback(() => {
    setShowVersionHistory((prev) => {
      const next = !prev
      if (next && currentDrawingIdRef.current) {
        void loadVersions()
      }
      return next
    })
  }, [loadVersions])

  const restoreVersion = useCallback(
    async (versionId: string, versionNumber: number) => {
      const drawingId = currentDrawingIdRef.current
      if (!drawingId) return

      const { data } = await versionsApi.restore(drawingId, versionId)
      const drawing = data.drawing as DrawingFull

      const loadedMessages = Array.isArray(drawing.conversationHistory)
        ? drawing.conversationHistory
        : []
      const loadedScene = sanitizeScene(drawing.sceneJson)

      messagesRef.current = loadedMessages
      sceneJsonRef.current = loadedScene
      setMessages(loadedMessages)
      setSceneJson(loadedScene)
      setSemanticState(undefined)
      applySceneToCanvas(excalidrawAPIRef.current, loadedScene)
      saveToStorage(loadedMessages, loadedScene)

      await loadVersions()
      setVersionToast(`Restored to v${versionNumber}`)
      window.setTimeout(() => setVersionToast(null), 3000)
    },
    [loadVersions]
  )

  const currentVersionNumber =
    versions.length > 0
      ? Math.max(...versions.map((v) => v.versionNumber))
      : null

  const resolveFolderName = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      setCurrentFolderName(null)
      return
    }

    try {
      const { data } = await foldersApi.list()
      const folder = (data as Folder[]).find((item) => item._id === folderId)
      setCurrentFolderName(folder?.name ?? null)
    } catch {
      setCurrentFolderName(null)
    }
  }, [])

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
      setSemanticState(
        drawing.semanticState
          ? (drawing.semanticState as ClientSemanticState)
          : undefined
      )
      setCurrentDrawingId(drawing._id)
      setCurrentTitle(drawing.title ?? 'Untitled Drawing')
      const folderId = drawing.folderId ?? null
      setCurrentFolderId(folderId)
      setCurrentTags(Array.isArray(drawing.tags) ? drawing.tags : [])
      await resolveFolderName(folderId)
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
      setCurrentFolderId(null)
      setCurrentFolderName(null)
      setCurrentTags([])
    } finally {
      setIsCanvasLoading(false)
    }
  }, [resolveFolderName])

  const importLocalStorageDraft = useCallback(() => {
    const storedScene = loadSceneFromStorage()
    const storedMessages = loadMessagesFromStorage()
    if (!storedScene) return false

    messagesRef.current = storedMessages
    sceneJsonRef.current = storedScene
    setMessages(storedMessages)
    setSceneJson(storedScene)
    setSemanticState(undefined)
    setCurrentDrawingId(null)
    setCurrentTitle('Untitled Drawing')
    setCurrentFolderId(null)
    setCurrentFolderName(null)
    setCurrentTags([])
    applySceneToCanvas(excalidrawAPIRef.current, storedScene)
    return true
  }, [])

  const resetFreshCanvas = useCallback(() => {
    setCurrentDrawingId(null)
    setCurrentTitle('Untitled Drawing')
    setCurrentFolderId(null)
    setCurrentFolderName(null)
    setCurrentTags([])
    setMessages([])
    setSceneJson(EMPTY_SCENE)
    setSemanticState(undefined)
    clearLocalStorage()
    setIsCanvasLoading(false)
    prevSceneRef.current = null
    setCanUndo(false)
    applySceneToCanvas(excalidrawAPIRef.current, EMPTY_SCENE)
  }, [])

  async function generateThumbnail(): Promise<string | null> {
    const api = excalidrawAPIRef.current
    if (!api) return null
    const elements = api.getSceneElements()
    if (elements.length === 0) return null

    try {
      const blob = await exportToBlob({
        elements,
        appState:         { exportBackground: true, viewBackgroundColor: '#ffffff' } as AppState,
        files:            api.getFiles(),
        maxWidthOrHeight: 400,
        quality:          0.65,
      })
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const saveDrawing = useCallback(
    async (options?: SaveDrawingOptions): Promise<string | null> => {
      const nextTitle = options?.title ?? currentTitleRef.current
      const nextFolderId =
        options?.folderId !== undefined
          ? options.folderId
          : currentFolderIdRef.current
      const nextTags = options?.tags ?? currentTagsRef.current
      const silent = options?.silent ?? false

      if (!silent) setIsSaving(true)
      try {
        const thumbnail = await generateThumbnail()
        const payload = {
          title: nextTitle,
          sceneJson: sceneJsonRef.current,
          conversationHistory: messagesRef.current,
          folderId: nextFolderId,
          tags: nextTags,
          thumbnail,
          semanticState: semanticStateRef.current,
        }

        if (currentDrawingIdRef.current) {
          await drawingsApi.update(currentDrawingIdRef.current, payload)
          setCurrentTitle(nextTitle)
          setCurrentFolderId(nextFolderId)
          setCurrentTags(nextTags)
          await resolveFolderName(nextFolderId)
          void loadVersions()
          return currentDrawingIdRef.current
        }

        const { data } = await drawingsApi.create(payload)
        const drawing = data as DrawingFull
        setCurrentDrawingId(drawing._id)
        setCurrentTitle(drawing.title ?? nextTitle)
        const savedFolderId = drawing.folderId ?? nextFolderId
        setCurrentFolderId(savedFolderId)
        setCurrentTags(
          Array.isArray(drawing.tags) ? drawing.tags : nextTags
        )
        await resolveFolderName(savedFolderId)
        clearLocalStorage()
        void loadVersions(drawing._id)
        return drawing._id
      } finally {
        if (!silent) setIsSaving(false)
      }
    },
    [loadVersions, resolveFolderName]
  )

  const autoSaveDrawing = useCallback(
    async (updatedScene: object) => {
      const drawingId = currentDrawingIdRef.current
      if (!drawingId) return

      try {
        await drawingsApi.update(drawingId, {
          title:               currentTitleRef.current,
          sceneJson:           updatedScene,
          conversationHistory: messagesRef.current,
          semanticState:       semanticStateRef.current,
        })
        void loadVersions()
      } catch (error) {
        console.warn('Auto-save failed:', error)
      }
    },
    [loadVersions]
  )

  const shareDrawing = useCallback(async (): Promise<{
    url: string
    drawingId: string
  } | null> => {
    let drawingId = currentDrawingIdRef.current
    if (!drawingId) {
      drawingId = (await saveDrawing({ silent: true })) ?? null
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

  async function runVisualFeedback(
    sceneJson:    Record<string, unknown>,
    originalPlan: object | null,
  ): Promise<void> {
    const excalidrawAPI = excalidrawAPIRef.current
    if (!autoCorrectRef.current || !excalidrawAPI || !originalPlan) return

    const elements = excalidrawAPI.getSceneElements()
    if (elements.length === 0) return

    setIsCritiquing(true)
    setLastCorrected(false)

    try {
      // Wait one frame for Excalidraw to finish rendering
      await new Promise<void>(r => setTimeout(r, 500))

      const blob = await exportToBlob({
        elements,
        appState: {
          exportBackground:    true,
          viewBackgroundColor: '#ffffff',
        } as Parameters<typeof exportToBlob>[0]['appState'],
        files:            excalidrawAPI.getFiles(),
        maxWidthOrHeight: 900,
        quality:          0.55,
      })

      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader   = new FileReader()
        reader.onload  = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const result = await critiqueApi.run(imageBase64, originalPlan, sceneJson)

      if (result.corrected && result.sceneJson) {
        const newScene = result.sceneJson as Record<string, unknown>
        setSceneJson(newScene)
        excalidrawAPI.updateScene({
          elements: (newScene.elements as never[]) ?? [],
          appState: {} as never,
        })
        excalidrawAPI.scrollToContent()
        setLastCorrected(true)
        setTimeout(() => setLastCorrected(false), 4000)
      }
    } catch (err) {
      console.warn('[VISUAL FEEDBACK]', err instanceof Error ? err.message : err)
    } finally {
      setIsCritiquing(false)
    }
  }

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

      const intentResult = detectIntent(trimmed)
      const effectiveTheme = intentResult.theme ?? themeRef.current

      if (intentResult.intent !== 'default') {
        setDetectedIntent(`${intentResult.emoji} ${intentResult.label}`)
        setTimeout(() => setDetectedIntent(''), 3000)
      }

      setMessages(nextMessages)
      setIsLoading(true)
      saveToStorage(nextMessages, sceneJsonRef.current)

      try {
        const data = await api.sendMessage(
          trimmed, nextMessages, sceneJsonRef.current, effectiveTheme,
          semanticStateRef.current,
        )

        if (data.stages?.length) {
          for (const stage of data.stages) {
            setLoadingStage(stage)
            await new Promise<void>(r => setTimeout(r, 350))
          }
        }
        setLoadingStage('Thinking...')

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

        prevSceneRef.current = sceneJsonRef.current
        setCanUndo(true)
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

        if (data.semanticState) {
          setSemanticState(data.semanticState)
        }

        if (data.lastPlan) {
          void runVisualFeedback(safeScene as Record<string, unknown>, data.lastPlan)
        }
      } catch (err: unknown) {
        let content = 'Something went wrong — try again.'

        if (axios.isAxiosError(err)) {
          const status = err.response?.status
          const serverMsg = err.response?.data?.error as string | undefined

          if (status === 503) {
            content = serverMsg ?? 'The drawing service is busy — try again in a moment.'
          } else if (status === 429) {
            content = serverMsg ?? 'Too many requests — wait a moment and try again.'
          } else if (err.code === 'ECONNABORTED') {
            content = 'This is taking too long — try a simpler request.'
          } else if (serverMsg) {
            content = serverMsg
          }
        }

        setErrorToast(content)
      } finally {
        setIsLoading(false)
      }
    },
    [autoSaveDrawing]
  )

  async function ingestDocument(content: string, filename?: string): Promise<void> {
    setIsLoading(true)
    setLoadingStage('Reading document...')

    try {
      const data = await ingestApi.fromContent(content, filename, semanticStateRef.current)

      if (data.stages?.length) {
        for (const stage of data.stages) {
          setLoadingStage(stage)
          await new Promise<void>(r => setTimeout(r, 350))
        }
      }

      const safeScene = sanitizeScene(data.sceneJson)
      prevSceneRef.current = sceneJsonRef.current
      setCanUndo(true)
      setSceneJson(safeScene)
      applySceneToCanvas(excalidrawAPIRef.current, safeScene)

      if (data.semanticState) {
        setSemanticState(data.semanticState)
      }

      setMessages(prev => [
        ...prev,
        createMessage('assistant', data.reply || 'Here is a diagram of your document.', data.toolsUsed),
      ])
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { error?: string })?.error ?? err.message)
        : err instanceof Error ? err.message : 'Could not generate diagram'
      throw err instanceof Error ? err : new Error(msg)
    } finally {
      setIsLoading(false)
      setLoadingStage('Thinking...')
    }
  }

  const undoLastAiAction = useCallback(() => {
    if (!prevSceneRef.current) return
    const prev = prevSceneRef.current
    prevSceneRef.current = null
    setCanUndo(false)
    setSceneJson(prev)
    applySceneToCanvas(excalidrawAPIRef.current, prev)
  }, [])

  function changeTheme(t: 'minimal' | 'default' | 'vibrant') {
    setTheme(t)
    localStorage.setItem('ai-drawing-theme', t)
  }

  const retryLastMessage = useCallback(() => {
    const userMessages = messagesRef.current.filter(m => m.role === 'user')
    const last = userMessages[userMessages.length - 1]
    if (last) void sendMessage(last.content)
  }, [sendMessage])

  const clearAll = useCallback(async () => {
    try {
      const data = await api.clearCanvas()
      const emptyScene = data.sceneJson ?? EMPTY_SCENE

      setMessages([])
      setSceneJson(emptyScene)
      setSemanticState(undefined)
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

  function canvasToScreen(
    canvasX: number,
    canvasY: number,
    nodeWidth: number,
    appState: { scrollX: number; scrollY: number; zoom: { value: number } }
  ): { screenX: number; screenY: number } {
    const z = appState.zoom.value
    return {
      screenX: Math.round((canvasX + nodeWidth / 2 + appState.scrollX) * z),
      screenY: Math.round((canvasY + appState.scrollY) * z),
    }
  }

  const handleSceneChange = useCallback(
    (elements: readonly unknown[], appState: AppState) => {
      const selectedIds = Object.keys(
        (appState as unknown as Record<string, unknown>).selectedElementIds as Record<string, boolean> ?? {}
      )

      if (selectedIds.length === 1) {
        const el = (elements as Record<string, unknown>[])
          .find(e => e.id === selectedIds[0])

        if (
          el &&
          ['rectangle', 'ellipse', 'diamond'].includes(el.type as string) &&
          (el.label as Record<string, unknown>)?.text
        ) {
          const label = (el.label as Record<string, unknown>).text as string
          const { screenX, screenY } = canvasToScreen(
            el.x as number,
            el.y as number,
            el.width as number,
            appState as { scrollX: number; scrollY: number; zoom: { value: number } }
          )
          setSelectedNode({ id: el.id as string, label, screenX, screenY })
        } else {
          setSelectedNode(null)
        }
      } else {
        setSelectedNode(null)
      }

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
    currentFolderId,
    currentFolderName,
    currentTags,
    isSaving,
    sendMessage,
    ingestDocument,
    retryLastMessage,
    loadingStage,
    theme,
    changeTheme,
    selectedNode,
    clearSelectedNode: () => setSelectedNode(null),
    canUndo,
    undoLastAiAction,
    errorToast,
    clearErrorToast: () => setErrorToast(null),
    clearAll,
    saveDrawing,
    shareDrawing,
    loadDrawing,
    resetFreshCanvas,
    importLocalStorageDraft,
    setCurrentTitle,
    excalidrawAPIRef,
    setExcalidrawAPI,
    handleSceneChange,
    showVersionHistory,
    toggleVersionHistory,
    versions,
    versionsLoading,
    loadVersions,
    restoreVersion,
    currentVersionNumber,
    versionToast,
    autoCorrectEnabled,
    setAutoCorrectEnabled: (v: boolean) => {
      autoCorrectRef.current = v
      setAutoCorrectEnabled(v)
      localStorage.setItem('ai-drawing-autocorrect', String(v))
    },
    lastCorrected,
    isCritiquing,
    detectedIntent,
  }
}
