'use client'

import { useState } from 'react'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useAnalysisContext } from '@/store/analysisContext'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { QuickStartButtons } from './QuickStartButtons'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'
import { AgentMessage } from '@/types/message'
import { INITIAL_MESSAGE } from '@/constants/messages'

export function AgentPanel() {
  const { chatMessages, input, setInput, append, isLoading, agentStatus, startNewAnalysis } =
    useAgentChat()
  const { status: geoStatus, requestLocation } = useGeolocation()
  const { setAnalysisContext } = useAnalysisContext()

  const [initMessage, setInitMessage] = useState<AgentMessage>(INITIAL_MESSAGE)
  // confirm 액션 클릭 후 true, 퀵스타트 클릭 or 직접 전송 후 false
  const [showQuickStart, setShowQuickStart] = useState(false)

  const confirmInitAction = (action: string) => {
    setInitMessage((prev) => ({ ...prev, confirmedAction: action }))
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    setShowQuickStart(false)
    append(input)
  }

  const handleQuickStart = (text: string) => {
    setShowQuickStart(false)
    startNewAnalysis()
    setInitMessage(INITIAL_MESSAGE)
    append(text)
  }

  const handleConfirmAction = async (action: string) => {
    switch (action) {
      case 'use_current_location': {
        confirmInitAction(action)

        const pos = await requestLocation()
        if (pos) {
          // 지도 중심만 이동 — 채팅 메시지는 전송하지 않음
          setAnalysisContext({ userLocation: pos })
        }
        // 권한 거부/불가 시에도 퀵스타트 노출 → 직접 입력으로 fallback
        setShowQuickStart(true)
        document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
        break
      }

      case 'input_manually': {
        confirmInitAction(action)
        setShowQuickStart(true)
        document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
        break
      }

      default: {
        const actionTextMap: Record<string, string> = {
          change_radius_300: '네, 300m로 변경해주세요.',
          keep_radius_500: '500m로 유지할게요.',
        }
        append(actionTextMap[action] ?? action)
        break
      }
    }
  }

  const displayMessages = [initMessage, ...chatMessages]

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={agentStatus} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          messages={displayMessages}
          onConfirmAction={handleConfirmAction}
          isStreaming={isLoading}
          disableConfirm={geoStatus === 'loading'}
        />
        {showQuickStart && (
          <div className="border-border flex-shrink-0 border-t px-3 py-2">
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
