'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/types/agent'
import { MessageBubble } from './MessageBubble'
import { QuickStartButtons } from './QuickStartButtons'

interface MessageThreadProps {
  messages: Message[]
  onQuickStart: (text: string) => void
}

export function MessageThread({ messages, onQuickStart }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasUserMessage = messages.some((m) => m.role === 'user')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      {messages.map((msg, i) => (
        <div key={msg.id}>
          <MessageBubble role={msg.role} content={msg.content} />
          {i === 0 && msg.role === 'agent' && !hasUserMessage && (
            <QuickStartButtons onSelect={onQuickStart} />
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
