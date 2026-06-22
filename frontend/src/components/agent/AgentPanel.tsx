'use client'

import { useState } from 'react'
import { AgentStatus } from '@/types/agent'
import { ChatMessage, UserMessage } from '@/types/message'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { QuickStartButtons } from './QuickStartButtons'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init',
    role: 'agent',
    content:
      '안녕하세요! 창업을 준비 중이신가요?\n업종과 후보 위치를 알려주시면 반경 내 경쟁 현황, 유동인구, 리스크를 분석해드릴게요.',
  },
]

export function AgentPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [status] = useState<AgentStatus>('idle') // TODO: AI SDK 연동 시 setStatus 활성화

  const hasUserMessage = messages.some((m) => m.role === 'user')

  const handleSend = (text: string) => {
    const userMessage: UserMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])
    // TODO: Vercel AI SDK 연동
  }

  const handleConfirmAction = (action: string) => {
    console.log('Confirm action:', action)
    // TODO: 액션 식별자에 따른 처리 (반경 변경 등)
  }

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={status} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageThread messages={messages} onConfirmAction={handleConfirmAction} />
        {!hasUserMessage && (
          <div className="flex-shrink-0 border-t border-border px-3 py-2">
            <QuickStartButtons onSelect={handleSend} />
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} disabled={status === 'analyzing'} />
      <Disclaimer />
    </div>
  )
}
