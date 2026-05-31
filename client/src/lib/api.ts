import axios from 'axios'
import type { Message } from './types'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

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
  return response.data as { reply: string, sceneJson: object, toolsUsed: string[] }
}

export const clearCanvas = async () => {
  const response = await api.post('/clear')
  return response.data as { sceneJson: object }
}
