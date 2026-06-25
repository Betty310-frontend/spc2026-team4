'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { UIMessage } from 'ai'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'

import { useAnalysisResult, abortMapUpdate, setChatLoading } from '@/store/analysisResult'
import { convertToChatMessages } from '@/lib/messageConverter'
import { handleToolResult } from '@/lib/toolResultParser'
import {
  extractRadiusFromText,
  parseContextFromToolArgs,
  parseContextFromAssistantText,
} from '@/lib/contextParser'
import { hasForbiddenWord } from '@/lib/guardrail'
import {
  applyAgentEventToStore,
  applyCompetitors,
  extractCompetitorsFromMessage,
  parseAgentEventLine,
  normalizeCompetitors,
  type CompetitorsApiResponse,
} from '@/lib/agent-event-bridge'

interface UseAgentChatOptions {
  onChatError?: (error: Error) => void
}

export function useAgentChat({ onChatError }: UseAgentChatOptions = {}) {
  const { analysisContext, setAnalysisContext } = useAnalysisContext()
  const { updateMetric, setReportData, reset } = useAnalysisResult()
  const [input, setInput] = useState('')
  const analysisContextRef = useRef(analysisContext)
  const appliedCompetitorMessagesRef = useRef<Set<string>>(new Set())

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

    onData(dataPart) {
      const dataPartAny = dataPart as { type?: string; data?: unknown }

      if (typeof dataPartAny.type === 'string' && dataPartAny.type.startsWith('data-')) {
        if (dataPartAny.type === 'data-search_competitors' && dataPartAny.data) {
          if (typeof dataPartAny.data === 'object' && dataPartAny.data !== null) {
            applyCompetitors(normalizeCompetitors(dataPartAny.data as CompetitorsApiResponse))
          }
        }
        return
      }

      if (typeof dataPartAny.data === 'string') {
        const evt = parseAgentEventLine(dataPartAny.data)
        if (evt) applyAgentEventToStore(evt)
      }
    },

    onFinish({ message }: { message: UIMessage }) {
      // tool result → 지표 카드 업데이트 + context 파싱
      for (const part of message.parts) {
        if (
          part.type === 'dynamic-tool' ||
          part.type === 'tool-search_competitors' ||
          part.type === 'tool-get_population_flow' ||
          part.type === 'tool-calc_competition_percentile' ||
          part.type === 'tool-get_rent_info' ||
          part.type === 'tool-get_positioning_data'
        ) {
          if (!('output' in part)) continue
          const p = part as {
            toolName?: string
            input: unknown
            output: unknown
          }
          const toolName = p.toolName ?? part.type.replace(/^tool-/, '')
          handleToolResult(toolName, p.output, updateMetric, setReportData)
          // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
          parseContextFromToolArgs(
            toolName,
            p.input as Record<string, unknown>,
            setAnalysisContext,
          )
        }
      }

      // 금지어 필터는 텍스트에만 적용하고, 툴 결과/지도 반영은 먼저 끝낸다.
      const textContent = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => ('text' in p ? (p as { text: string }).text : ''))
        .join('')

      if (hasForbiddenWord(textContent)) {
        console.warn('[guardrail] 금지어 감지 — 재요청 필요', { textContent })
        // TODO: 재요청 로직 (최대 1회, 무한루프 방지)
      }

      parseContextFromAssistantText(textContent, setAnalysisContext)
    },

    onError(error: Error) {
      abortMapUpdate()
      console.error('[agent:error]', error)
      onChatErrorRef.current?.(error)
    },
  })

  useEffect(() => {
    for (const message of messages) {
      if (appliedCompetitorMessagesRef.current.has(message.id)) continue

      const normalized = extractCompetitorsFromMessage(message)
      if (!normalized) continue

      applyCompetitors(normalized)
      appliedCompetitorMessagesRef.current.add(message.id)
    }
  }, [messages])

  const chatMessages = useMemo(() => convertToChatMessages(messages), [messages])
  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    setChatLoading(isLoading)
  }, [isLoading])

  const append = (text: string) => {
    const parsedRadius = extractRadiusFromText(text)
    const nextRadius = parsedRadius ?? analysisContextRef.current.radius ?? 500

    if (parsedRadius != null && parsedRadius !== analysisContextRef.current.radius) {
      setAnalysisContext({ radius: parsedRadius })
      analysisContextRef.current = {
        ...analysisContextRef.current,
        radius: parsedRadius,
      }
    }

    sendMessage(
      { text },
      {
        body: {
          station: analysisContextRef.current.location ?? '',
          category: analysisContextRef.current.industry ?? '',
          radius: nextRadius,
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
    startNewAnalysis: () => {
      abortMapUpdate()
      appliedCompetitorMessagesRef.current.clear()
      reset()
      setChatLoading(false)
    },
  }
}
