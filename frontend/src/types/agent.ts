export type AgentStatus = 'idle' | 'analyzing' | 'done' | 'chatting'
export type MessageRole = 'agent' | 'user'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp?: Date
}
