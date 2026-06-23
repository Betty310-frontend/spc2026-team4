'use client'

import { useAgentChat } from '@/hooks/useAgentChat'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { QuickStartButtons } from './QuickStartButtons'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'

export function AgentPanel() {
  const {
    chatMessages,
    input,
    setInput,
    append,
    isLoading,
    agentStatus,
    startNewAnalysis,
  } = useAgentChat()

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    append(input)
  }

  const handleQuickStart = (text: string) => {
    startNewAnalysis()
    append(text)
  }

  const handleConfirmAction = (action: string) => {
    const actionTextMap: Record<string, string> = {
      change_radius_300: '네, 300m로 변경해주세요.',
      keep_radius_500: '500m로 유지할게요.',
    }
    append(actionTextMap[action] ?? action)
  }

  const showQuickStart = chatMessages.length <= 1

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={agentStatus} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          messages={chatMessages}
          onConfirmAction={handleConfirmAction}
          isStreaming={isLoading}
        />
        {showQuickStart && (
          <div className="flex-shrink-0 border-t border-border px-3 py-2">
            <QuickStartButtons onSelect={handleQuickStart} />
          </div>
        )}
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading}
        placeholder={isLoading ? '분석 중…' : '업종과 위치를 입력하세요…'}
      />
      <Disclaimer />
    </div>
  )
}
