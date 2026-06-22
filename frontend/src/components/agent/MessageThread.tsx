'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage } from '@/types/message'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'

interface MessageThreadProps {
  messages: ChatMessage[]
  onConfirmAction?: (action: string) => void
}

export function MessageThread({ messages, onConfirmAction }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      {messages.map((msg) => {
        if (msg.role === 'tool') {
          return <ToolCallCard key={msg.id} message={msg} />
        }
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            onConfirmAction={onConfirmAction}
          />
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
