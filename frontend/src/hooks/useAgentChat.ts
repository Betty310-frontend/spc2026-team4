'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { UIMessage } from 'ai'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'

import { useAnalysisResult } from '@/store/analysisResult'
import { convertToChatMessages } from '@/lib/messageConverter'
import { handleToolResult } from '@/lib/toolResultParser'
import { parseContextFromToolArgs } from '@/lib/contextParser'
import { hasForbiddenWord } from '@/lib/guardrail'

interface UseAgentChatOptions {
  onChatError?: (error: Error) => void
}

export function useAgentChat({ onChatError }: UseAgentChatOptions = {}) {
  const { analysisContext, setAnalysisContext } = useAnalysisContext()
  const { updateMetric, setReportData, reset } = useAnalysisResult()
  const [input, setInput] = useState('')
  const analysisContextRef = useRef(analysisContext)

  // useChat options은 mount 시점에 클로저로 고정되므로 ref로 최신 콜백 유지
  const onChatErrorRef = useRef(onChatError)
  useEffect(() => {
    onChatErrorRef.current = onChatError
  }, [onChatError])

  useEffect(() => {
    analysisContextRef.current = analysisContext
  }, [analysisContext])

  const transport = useMemo(() => new DefaultChatTransport(), [])

  const { messages, sendMessage, status, stop } = useChat({
    transport,

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
      onChatErrorRef.current?.(error)
    },
  })

  const chatMessages = useMemo(() => convertToChatMessages(messages), [messages])
  const isLoading = status === 'submitted' || status === 'streaming'

  const append = (text: string) => {
    sendMessage(
      { text },
      {
        body: {
          station: analysisContextRef.current.location ?? '',
          category: analysisContextRef.current.industry ?? '',
          radius: analysisContextRef.current.radius ?? 500,
        },
      },
    )
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
