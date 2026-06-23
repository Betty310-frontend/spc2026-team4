'use client'

import { useChat } from '@ai-sdk/react'
import { UIMessage } from 'ai'
import { useState, useMemo } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'
import { useAnalysisResult } from '@/store/analysisResult'
import { convertToChatMessages } from '@/lib/messageConverter'
import { handleToolResult } from '@/lib/toolResultParser'
import { parseContextFromToolArgs } from '@/lib/contextParser'
import { hasForbiddenWord } from '@/lib/guardrail'

export function useAgentChat() {
  const { setAnalysisContext } = useAnalysisContext()
  const { updateMetric, setReportData, reset } = useAnalysisResult()
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, stop } = useChat({
    // api 기본값: '/api/chat' (DefaultChatTransport 기본 경로)
    // TODO: [FastAPI 교체] FastAPI 직접 연결 시 transport 옵션으로 변경
    // transport: new DefaultChatTransport({ api: process.env.NEXT_PUBLIC_API_BASE_URL + '/chat' })

    onFinish({ message }: { message: UIMessage }) {
      // 금지어 필터
      const textContent = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => ('text' in p ? (p as { text: string }).text : ''))
        .join('')

      if (hasForbiddenWord(textContent)) {
        console.warn('[guardrail] 금지어 감지 — 재요청 필요')
        // TODO: 재요청 로직 (최대 1회, 무한루프 방지)
        return
      }

      // tool result → 지표 카드 업데이트 + context 파싱
      for (const part of message.parts) {
        if (part.type === 'dynamic-tool' && 'output' in part) {
          const p = part as {
            toolName: string
            input: unknown
            output: unknown
          }
          handleToolResult(p.toolName, p.output, updateMetric, setReportData)
          // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
          parseContextFromToolArgs(
            p.toolName,
            p.input as Record<string, unknown>,
            setAnalysisContext,
          )
        }
      }
    },

    onError(error: Error) {
      console.error('[agent:error]', error)
    },
  })

  const chatMessages = useMemo(() => convertToChatMessages(messages), [messages])
  const isLoading = status === 'submitted' || status === 'streaming'

  const append = (text: string) => {
    // TODO: 조건 변경(반경·업종 수정) 시 setAnalysisContext로 부분 업데이트
    sendMessage({ text })
    setInput('')
  }

  return {
    chatMessages,
    input,
    setInput,
    append,
    isLoading,
    agentStatus: isLoading ? ('analyzing' as const) : ('idle' as const),
    stop,
    startNewAnalysis: reset,
  }
}
