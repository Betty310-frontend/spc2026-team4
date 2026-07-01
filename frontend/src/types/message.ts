export type MessageRole = 'user' | 'agent'

export type ToolStatus = 'loading' | 'done' | 'error'

export interface BaseMessage {
  id: string
  timestamp?: Date
}

export interface ConfirmButton {
  label: string
  variant: 'primary' | 'outline'
  action: string
}

export type ExplorationMessageType =
  | 'ask_radius'
  | 'ask_population'
  | 'competition'
  | 'report_offer'

export interface UserMessage extends BaseMessage {
  role: 'user'
  content: string
}

export interface AgentMessage extends BaseMessage {
  role: 'agent'
  content: string
  messageType?: ExplorationMessageType
  confirmButtons?: ConfirmButton[]
  confirmedAction?: string
  isError?: boolean
}

export interface ToolCallMessage extends BaseMessage {
  role: 'tool'
  toolName: string
  params: Record<string, unknown>
  status: ToolStatus
  resultText?: string
  errorText?: string
}

export type ChatMessage = UserMessage | AgentMessage | ToolCallMessage
