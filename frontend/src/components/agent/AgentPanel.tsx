'use client'

import { useState } from 'react'
import { AgentStatus, Message } from '@/types/agent'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'agent',
  content:
    '안녕하세요! 창업을 준비 중이신가요?\n업종과 후보 위치를 알려주시면 반경 내 경쟁 현황, 유동인구, 리스크를 분석해드릴게요.',
}

export function AgentPanel() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [status] = useState<AgentStatus>('idle') // TODO: AI SDK 연동 시 setStatus 활성화

  const handleSend = (text: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])
    console.log('Message sent:', text)
    // TODO: Vercel AI SDK 연동
  }

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={status} />
      <MessageThread messages={messages} onQuickStart={handleSend} />
      <ChatInput onSend={handleSend} disabled={status === 'analyzing'} />
      <Disclaimer />
    </div>
  )
}
