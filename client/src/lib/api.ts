import axios from 'axios'
import type { Message } from './types'

// In-memory token storage
let _accessToken: string | null = null
export function getAccessToken() { return _accessToken }
export function setAccessToken(token: string | null) { _accessToken = token }

function normalizeApiBaseUrl(rawUrl: string | undefined): string {
  const url = rawUrl?.trim()
  if (!url) return '/api'
  if (url === '/api' || url.endsWith('/api')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return `${url.replace(/\/$/, '')}/api`
  return url
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL as string | undefined)

const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000, withCredentials: true })

// Request interceptor: attach access token from memory
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: auto-refresh on 401
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const { data } = await api.post('/auth/refresh', {})
        setAccessToken(data.accessToken)
        refreshQueue.forEach((cb) => cb(data.accessToken))
        refreshQueue = []
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        setAccessToken(null)
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authApi = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

// Drawing endpoints
export const drawingsApi = {
  list: () => api.get('/drawings'),
  get: (id: string) => api.get(`/drawings/${id}`),
  create: (data: { title?: string; sceneJson: object; conversationHistory?: object[] }) =>
    api.post('/drawings', data),
  update: (
    id: string,
    data: {
      title?: string
      sceneJson?: object
      conversationHistory?: object[]
      folderId?: string | null
      tags?: string[]
    }
  ) => api.put(`/drawings/${id}`, data),
  delete: (id: string) => api.delete(`/drawings/${id}`),
  share: (id: string) => api.post(`/drawings/${id}/share`),
}

export const foldersApi = {
  list: () => api.get('/folders'),
  create: (data: { name: string; color?: string }) =>
    api.post('/folders', data),
  update: (id: string, data: { name?: string; color?: string }) =>
    api.put(`/folders/${id}`, data),
  delete: (id: string) => api.delete(`/folders/${id}`),
}

export const versionsApi = {
  list: (drawingId: string) =>
    api.get(`/drawings/${drawingId}/versions`),
  get: (drawingId: string, versionId: string) =>
    api.get(`/drawings/${drawingId}/versions/${versionId}`),
  restore: (drawingId: string, versionId: string) =>
    api.post(`/drawings/${drawingId}/versions/restore/${versionId}`),
}

// Share endpoint (no auth)
export const shareApi = {
  get: (shareId: string) => api.get(`/share/${shareId}`),
}

// Existing canvas endpoints (keep these)
export const sendMessage = async (message: string, history: Message[], sceneJson: object) => {
  const response = await api.post('/chat', {
    message,
    history: history
      .filter((m): m is Message & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant'
      )
      .slice(-20)
      .map(({ role, content }) => ({ role, content })),
    sceneJson
  })
  return response.data as {
    reply: string
    sceneJson: object
    toolsUsed: string[]
    mermaidDiagram?: string
  }
}

export const clearCanvas = async () => {
  const response = await api.post('/clear')
  return response.data as { sceneJson: object }
}
