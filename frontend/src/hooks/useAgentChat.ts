'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { UIMessage } from 'ai'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'
import type { AnalysisContext } from '@/types/analysis'

import { useAnalysisResult, abortMapUpdate } from '@/store/analysisResult'
import { convertToChatMessages } from '@/lib/messageConverter'
import { handleToolResult } from '@/lib/toolResultParser'
import {
  extractRadiusFromText,
  parseContextFromToolArgs,
  parseContextFromAssistantText,
} from '@/lib/contextParser'
import { extractCategoryFromText, isValidCategory, normalizeCategory } from '@/lib/category'
import { extractLocationCandidateFromText, resolveLocationToCenter } from '@/lib/geocode'
import { hasForbiddenWord } from '@/lib/guardrail'
import {
  applyAgentEventToStore,
  applyCompetitors,
  extractCompetitorsFromMessage,
  parseAgentEventLine,
  normalizeCompetitors,
  type CompetitorsApiResponse,
} from '@/lib/agent-event-bridge'
import chatRefreshGuardModule from '@/lib/chatRefreshGuard'

const { ANALYSIS_TOOL_NAMES, createChatRefreshGuard } = chatRefreshGuardModule as {
  ANALYSIS_TOOL_NAMES: readonly string[]
  createChatRefreshGuard: () => {
    markRagSources: () => void
    markAnalysisTool: () => void
    reset: () => void
  }
}

interface UseAgentChatOptions {
  onChatError?: (error: Error) => void
  onCategoryMissing?: () => void
  onAssistantFinish?: (payload: {
    kind: 'explore' | 'reply' | 'report'
    text: string
    hasQuestion: boolean
  }) => void
}

interface AppendOptions {
  kind?: 'explore' | 'reply' | 'report'
  category?: string
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { onChatError, onCategoryMissing, onAssistantFinish } = options
  const { analysisContext, confirmPosition, getConfirmedPosition, setAnalysisContext } =
    useAnalysisContext()
  const { updateMetric, setReportData, reset, startLoading, stopLoading } =
    useAnalysisResult()
  const [input, setInput] = useState('')
  const analysisContextRef = useRef(analysisContext)
  const appliedCompetitorMessagesRef = useRef<Set<string>>(new Set())
  const processedToolCallIdsRef = useRef<Set<string>>(new Set())
  const refreshGuardRef = useRef(createChatRefreshGuard())
  const pendingMapCenterRef = useRef<{ center: { lat: number; lng: number }; dongName: string | null } | null>(null)
  const skipDataMapConfirmRef = useRef(false)
  const pendingAppendKindRef = useRef<'explore' | 'reply' | 'report'>('reply')

  // useChat options은 mount 시점에 클로저로 고정되므로 ref로 최신 콜백 유지
  const onChatErrorRef = useRef(onChatError)
  const onCategoryMissingRef = useRef(onCategoryMissing)
  const onAssistantFinishRef = useRef<UseAgentChatOptions['onAssistantFinish']>(undefined)
  useEffect(() => {
    onChatErrorRef.current = onChatError
  }, [onChatError])
  useEffect(() => {
    onCategoryMissingRef.current = onCategoryMissing
  }, [onCategoryMissing])
  useEffect(() => {
    onAssistantFinishRef.current = onAssistantFinish
  }, [onAssistantFinish])

  useEffect(() => {
    analysisContextRef.current = analysisContext
  }, [analysisContext])

  const transport = useMemo(() => new DefaultChatTransport(), [])

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  const { messages, sendMessage, status, stop } = useChat({
    transport,

    onData(dataPart) {
      const dataPartAny = dataPart as { type?: string; data?: unknown }

      if (typeof dataPartAny.type === 'string' && dataPartAny.type.startsWith('data-')) {
        if (dataPartAny.type === 'data-sources') {
          refreshGuardRef.current.markRagSources()
          return
        }

        if (dataPartAny.type === 'data-search_competitors' && dataPartAny.data) {
          refreshGuardRef.current.markAnalysisTool()
          if (isRecord(dataPartAny.data)) {
            applyCompetitors(normalizeCompetitors(dataPartAny.data as CompetitorsApiResponse))
          }
          return
        }

        if (
          dataPartAny.type === 'data-tool-end' &&
          isRecord(dataPartAny.data) &&
          typeof dataPartAny.data.tool === 'string' &&
          ANALYSIS_TOOL_NAMES.includes(dataPartAny.data.tool as (typeof ANALYSIS_TOOL_NAMES)[number])
        ) {
          refreshGuardRef.current.markAnalysisTool()
          return
        }

        if (
          dataPartAny.type === 'data-tool-start' &&
          isRecord(dataPartAny.data) &&
          dataPartAny.data.tool === 'search_competitors' &&
          isRecord(dataPartAny.data.input)
        ) {
          refreshGuardRef.current.markAnalysisTool()
          pendingMapCenterRef.current = null
          setAnalysisContext({
            center: null,
          })
          analysisContextRef.current = {
            ...analysisContextRef.current,
            center: null,
          }
          const parsedContext = parseContextFromToolArgs(
            'search_competitors',
            dataPartAny.data.input,
            setAnalysisContext,
          )
          if (parsedContext) {
            analysisContextRef.current = {
              ...analysisContextRef.current,
              ...parsedContext,
            }
          }
          return
        }

        if (dataPartAny.type === 'data-map' && isRecord(dataPartAny.data)) {
          if (skipDataMapConfirmRef.current) {
            return
          }

          const center = isRecord(dataPartAny.data.center)
            ? {
                lat:
                  typeof dataPartAny.data.center.lat === 'number' ? dataPartAny.data.center.lat : null,
                lng:
                  typeof dataPartAny.data.center.lng === 'number' ? dataPartAny.data.center.lng : null,
            }
          : null

          if (typeof dataPartAny.data.dong_name === 'string' && dataPartAny.data.dong_name) {
            setAnalysisContext({
              location: dataPartAny.data.dong_name,
            })
            analysisContextRef.current = {
              ...analysisContextRef.current,
              location: dataPartAny.data.dong_name,
            }
          }

          if (center?.lat != null && center?.lng != null) {
            pendingMapCenterRef.current = {
              center: { lat: center.lat, lng: center.lng },
              dongName: typeof dataPartAny.data.dong_name === 'string' ? dataPartAny.data.dong_name : null,
            }
          }
          return
        }

        if (typeof dataPartAny.data === 'string') {
          const evt = parseAgentEventLine(dataPartAny.data)
          if (evt) {
            if (
              evt.event === 'tool' &&
              typeof evt.name === 'string' &&
              ANALYSIS_TOOL_NAMES.includes(evt.name as (typeof ANALYSIS_TOOL_NAMES)[number])
            ) {
              refreshGuardRef.current.markAnalysisTool()
            }
            applyAgentEventToStore(evt)
          }
          return
        }

        if (isRecord(dataPartAny.data)) {
          const evt = {
            event: dataPartAny.type.replace(/^data-/, ''),
            ...dataPartAny.data,
          }
          if (isRecord(evt) && typeof evt.event === 'string') {
            const evtRecord = evt as Record<string, unknown>
            if (
              evt.event === 'tool' &&
              typeof evtRecord.name === 'string' &&
              ANALYSIS_TOOL_NAMES.includes(
                evtRecord.name as (typeof ANALYSIS_TOOL_NAMES)[number],
              )
            ) {
              refreshGuardRef.current.markAnalysisTool()
            }
            applyAgentEventToStore(evt as { event: 'tool' | 'status' | 'delta' })
          }
        }
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
          part.type === 'tool-get_positioning_data'
        ) {
          if (!('output' in part)) continue
          const p = part as {
            toolName?: string
            toolCallId?: string
            input: unknown
            output: unknown
          }
          const toolName = p.toolName ?? part.type.replace(/^tool-/, '')

          if (typeof p.toolCallId === 'string') {
            if (processedToolCallIdsRef.current.has(p.toolCallId)) {
              continue
            }
            processedToolCallIdsRef.current.add(p.toolCallId)
          }

          handleToolResult(toolName, p.output, updateMetric, setReportData)

          // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
          const parsedContext = parseContextFromToolArgs(
            toolName,
            p.input as Record<string, unknown>,
            setAnalysisContext,
          )
          if (parsedContext) {
            analysisContextRef.current = {
              ...analysisContextRef.current,
              ...parsedContext,
            }
          }
        }
      }

      const pendingMapCenter = pendingMapCenterRef.current
      if (pendingMapCenter && !skipDataMapConfirmRef.current) {
        pendingMapCenterRef.current = null
        void confirmPosition(pendingMapCenter.center.lat, pendingMapCenter.center.lng).then((confirmed) => {
          if (!confirmed) return
          analysisContextRef.current = {
            ...analysisContextRef.current,
            confirmedPosition: confirmed,
            location: pendingMapCenter.dongName ?? confirmed.dongName,
            dongCode: confirmed.dongCode,
          }
        })
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

      const assistantContext = parseContextFromAssistantText(textContent, setAnalysisContext)
      if (assistantContext) {
        analysisContextRef.current = {
          ...analysisContextRef.current,
          ...assistantContext,
        }
      }
      const hasQuestion = /[?？]|(?:까요|나요|죠|어떨까요|궁금)/.test(textContent)
      onAssistantFinishRef.current?.({
        kind: pendingAppendKindRef.current,
        text: textContent,
        hasQuestion,
      })
      pendingAppendKindRef.current = 'reply'

      refreshGuardRef.current.reset()
    },

    onError(error: Error) {
      abortMapUpdate()
      pendingMapCenterRef.current = null
      skipDataMapConfirmRef.current = false
      refreshGuardRef.current.reset()
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
    if (isLoading) {
      startLoading('chat')
      return () => stopLoading('chat')
    }

    stopLoading('chat')
    return undefined
  }, [isLoading, startLoading, stopLoading])

  const append = async (
    text: string,
    contextOverride?: Partial<AnalysisContext>,
    options?: AppendOptions,
  ) => {
    refreshGuardRef.current.reset()
    pendingAppendKindRef.current = options?.kind ?? 'reply'
    const forcedCategory = options?.category?.trim() || null
    const baseContext = contextOverride
      ? { ...analysisContextRef.current, ...contextOverride }
      : analysisContextRef.current
    let nextContext = baseContext
    const parsedCategory = extractCategoryFromText(text)
    const parsedRadius = extractRadiusFromText(text)
    const locationCandidate = extractLocationCandidateFromText(text)
    let confirmedPosition = getConfirmedPosition() ?? baseContext.confirmedPosition ?? null
    let nextLocation = confirmedPosition?.dongName ?? baseContext.location ?? null
    const resolvedIndustry =
      (forcedCategory ? normalizeCategory(forcedCategory) : null) ??
      normalizeCategory(parsedCategory) ??
      baseContext.industry
    let resolvedLocally = false

    pendingMapCenterRef.current = null
    skipDataMapConfirmRef.current = false

    if (locationCandidate) {
      const locationResult = await resolveLocationToCenter(locationCandidate)
      if (!locationResult) {
        console.warn('[chat] 호출 차단: 위치 키워드를 찾지 못함', { text, locationCandidate })
        return
      }

      const confirmed = await confirmPosition(locationResult.center.lat, locationResult.center.lng)
      if (!confirmed) {
        console.warn('[chat] 호출 차단: 위치 확정 실패', { text, locationCandidate })
        return
      }

      confirmedPosition = confirmed
      nextLocation = confirmed.dongName
      resolvedLocally = true
      skipDataMapConfirmRef.current = true
      analysisContextRef.current = {
        ...analysisContextRef.current,
        confirmedPosition: confirmed,
        location: confirmed.dongName,
        dongCode: confirmed.dongCode,
      }
    }

    if (!confirmedPosition) {
      console.warn('[chat] 호출 차단: confirmedPosition이 없음', { text })
      return
    }

    if (!isValidCategory(resolvedIndustry)) {
      console.warn('[chat] 호출 차단: category가 비어있음', { text })
      onCategoryMissingRef.current?.()
      return
    }

    const nextIndustry = forcedCategory ? normalizeCategory(forcedCategory) : normalizeCategory(parsedCategory)
    if (nextIndustry && nextIndustry !== baseContext.industry) {
      setAnalysisContext({ industry: nextIndustry })
      nextContext = { ...nextContext, industry: nextIndustry }
    }

    if (parsedRadius != null && parsedRadius !== baseContext.radius) {
      setAnalysisContext({ radius: parsedRadius })
      nextContext = { ...nextContext, radius: parsedRadius }
    }

    nextContext = {
      ...nextContext,
      confirmedPosition,
      location: nextLocation,
      dongCode: confirmedPosition.dongCode,
    }

    if (
      contextOverride ||
      parsedRadius != null ||
      parsedCategory ||
      forcedCategory ||
      confirmedPosition ||
      resolvedLocally
    ) {
      analysisContextRef.current = nextContext
    }

    const nextRadius = parsedRadius ?? nextContext.radius ?? 500

    sendMessage(
      { text },
      {
        body: {
          station: nextLocation ?? '',
          category: resolvedIndustry,
          radius: nextRadius,
          lat: confirmedPosition?.lat ?? undefined,
          lng: confirmedPosition?.lng ?? undefined,
          mode: pendingAppendKindRef.current,
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
      pendingMapCenterRef.current = null
      skipDataMapConfirmRef.current = false
      appliedCompetitorMessagesRef.current.clear()
      processedToolCallIdsRef.current.clear()
      refreshGuardRef.current.reset()
      reset()
      stopLoading('chat')
    },
  }
}
