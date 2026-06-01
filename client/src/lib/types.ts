export interface Message {
  id: string
  role: "user" | "assistant" | "error"
  content: string
  toolsUsed?: string[]
  timestamp: number
}

export interface ChatState {
  messages: Message[]
  sceneJson: object
  isLoading: boolean
}

export interface User {
  id: string
  email: string
  createdAt?: string
}

export interface DrawingMeta {
  _id: string
  title: string
  updatedAt: string
  createdAt: string
  isPublic: boolean
  shareId?: string
}

export interface DrawingFull extends DrawingMeta {
  sceneJson: object
  conversationHistory: Message[]
}
