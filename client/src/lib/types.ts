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
