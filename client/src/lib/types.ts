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
  folderId?: string | null
  tags: string[]
  thumbnail?: string | null
}

export interface DrawingFull extends DrawingMeta {
  sceneJson: object
  conversationHistory: Message[]
}

export interface Folder {
  _id: string
  name: string
  color: string
  drawingCount?: number
}

export interface VersionMeta {
  _id: string
  versionNumber: number
  label: string
  elementCount: number
  createdAt: string
}

export interface VersionFull extends VersionMeta {
  sceneJson: object
  conversationHistory: Message[]
}
