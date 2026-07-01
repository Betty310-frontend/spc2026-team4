'use client'

import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useAnalysis } from '@/hooks/use-analysis'
import { useAnalysisContext } from '@/store/analysisContext'
import { useAnalysisResult } from '@/store/analysisResult'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { QuickStartButtons } from './QuickStartButtons'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'
import { detectQuickReplyType, type QuickReplyType } from '@/lib/quickReply'
import type {
  AgentMessage,
  ChatMessage,
  ExplorationMessageType,
} from '@/types/message'
import { INITIAL_MESSAGE } from '@/constants/messages'
import {
  beginMapUpdate,
  requestReportRefresh,
} from '@/store/analysisResult'
import { isValidCategory } from '@/lib/category'
import type { ConfirmedPosition } from '@/types/analysis'

const REPORT_REQUEST_KEYWORDS = [
  '분석해줘',
  '리포트',
  '정리해줘',
  '생성해줘',
  '보고서',
]

function hasExplicitReportRequest(text: string) {
  return REPORT_REQUEST_KEYWORDS.some((keyword) => text.includes(keyword))
}

function createExplorationState() {
  return {
    questionAsked: false,
    userResponded: false,
    radiusChanged: false,
    reportOffered: false,
  }
}

function inferExplorationMessageType(
  content: string,
): ExplorationMessageType | null {
  const normalized = content.replace(/\s+/g, '')

  if (
    normalized.includes('리포트를생성해드릴까요') ||
    normalized.includes('리포트를생성해드릴까요?') ||
    normalized.includes('상세리포트를생성해드릴까요')
  ) {
    return 'report_offer'
  }

  if (
    normalized.includes('반경을바꿔보고싶으신가요') ||
    normalized.includes('반경을바꿔보고싶으신가요?') ||
    normalized.includes('반경을바꿔보고싶나요') ||
    normalized.includes('반경을바꿔볼까요') ||
    normalized.includes('좁혀보고싶으신가요') ||
    normalized.includes('넓혀보고싶으신가요')
  ) {
    return 'ask_radius'
  }

  if (
    normalized.includes('특정시간대유동인구가더궁금하신가요') ||
    normalized.includes('유동인구가더궁금하신가요') ||
    normalized.includes('출퇴근시간대') ||
    normalized.includes('점심시간대') ||
    normalized.includes('저녁시간대') ||
    normalized.includes('주말유동인구')
  ) {
    return 'ask_population'
  }

  if (
    normalized.includes('지도에서직접확인') ||
    normalized.includes('리포트로상세히볼게요') ||
    normalized.includes('반경을바꿔볼게요')
  ) {
    return 'competition'
  }

  return null
}

interface AgentPanelProps {
  onOpenReportTab?: () => void
  onReportAnnouncementVisibleChange?: (visible: boolean) => void
}

export function AgentPanel({
  onOpenReportTab,
  onReportAnnouncementVisibleChange,
}: AgentPanelProps) {
  const { status: geoStatus, requestLocation } = useGeolocation()
  const { analysisContext, confirmPosition, setAnalysisContext } = useAnalysisContext()
  const { report } = useAnalysisResult()

  const [localMessages, setLocalMessages] = useState<AgentMessage[]>([])
  const [explorationState, setExplorationState] = useState(() => createExplorationState())
  const explorationStateRef = useRef(explorationState)
  const reportAnnouncementIdRef = useRef<string | null>(null)
  const reportAnnouncementPendingRef = useRef<string | null>(null)
  const reportAnnouncedRef = useRef<string | null>(null)
  const reportOfferIdRef = useRef<string | null>(null)
  const locationChangeNoticeIdRef = useRef<string | null>(null)
  const locationChangeNoticeLocationRef = useRef<string | null>(null)
  const [hiddenIndustryPromptId, setHiddenIndustryPromptId] = useState<string | null>(null)
  const [usedQuickReplyTypes, setUsedQuickReplyTypes] = useState<Set<QuickReplyType>>(
    () => new Set(),
  )
  const [disabledQuickActionIds, setDisabledQuickActionIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [messageOrderById, setMessageOrderById] = useState<Record<string, number>>({ init: 0 })
  const nextMessageOrderRef = useRef(1)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const prevChatLoadingRef = useRef(false)
  const prevRadiusRef = useRef<number | null>(analysisContext.radius)
  const prevLocationRef = useRef<string | null>(analysisContext.location)
  const prevIndustryRef = useRef<string | null>(analysisContext.industry)
  const hasSeenAnalysisContextRef = useRef(false)
  const lastAnalysisSignatureRef = useRef<string | null>(null)
  const analysisRunInFlightRef = useRef(false)
  const confirmedPositionRef = useRef<ConfirmedPosition | null>(analysisContext.confirmedPosition)

  const assignMessageOrder = useCallback((id: string) => {
    setMessageOrderById((prev) => {
      if (prev[id] != null) return prev

      const next = nextMessageOrderRef.current
      nextMessageOrderRef.current += 1
      return { ...prev, [id]: next }
    })
  }, [])

  const addAgentMessage = useCallback((msg: Omit<AgentMessage, 'id' | 'role'>) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setLocalMessages((prev) => [
      ...prev,
      { id, role: 'agent' as const, ...msg },
    ])
    return id
  }, [])

  useEffect(() => {
    explorationStateRef.current = explorationState
  }, [explorationState])

  useEffect(() => {
    confirmedPositionRef.current = analysisContext.confirmedPosition
  }, [analysisContext.confirmedPosition])

  const clearProgrammaticMessages = useCallback(() => {
    setLocalMessages([])
    reportAnnouncementIdRef.current = null
    reportAnnouncementPendingRef.current = null
    reportAnnouncedRef.current = null
    reportOfferIdRef.current = null
    locationChangeNoticeIdRef.current = null
    locationChangeNoticeLocationRef.current = null
    onReportAnnouncementVisibleChange?.(false)
  }, [onReportAnnouncementVisibleChange])

  const resetExplorationState = useCallback(() => {
    setExplorationState(createExplorationState())
    explorationStateRef.current = createExplorationState()
    setHiddenIndustryPromptId(null)
    setUsedQuickReplyTypes(new Set())
    setDisabledQuickActionIds(new Set())
    clearProgrammaticMessages()
  }, [clearProgrammaticMessages])

  const disableQuickActionMessage = useCallback((messageId: string) => {
    setDisabledQuickActionIds((prev) => {
      if (prev.has(messageId)) return prev
      const next = new Set(prev)
      next.add(messageId)
      return next
    })
  }, [])

  const makeReportRequestSnapshot = useCallback(
    () => ({
      위치: analysisContext.location ?? '',
      업종: analysisContext.industry ?? '',
      반경: analysisContext.radius ?? undefined,
      lat: analysisContext.confirmedPosition?.lat ?? undefined,
      lng: analysisContext.confirmedPosition?.lng ?? undefined,
    }),
    [
      analysisContext.confirmedPosition?.lat,
      analysisContext.confirmedPosition?.lng,
      analysisContext.industry,
      analysisContext.location,
      analysisContext.radius,
    ],
  )

  const promptIndustrySelection = useCallback(() => {
    addAgentMessage({
      content: '어떤 업종을 생각하고 계신가요?',
    })
  }, [addAgentMessage])

  const markQuickReplyTypeUsed = useCallback((type: QuickReplyType) => {
    setUsedQuickReplyTypes((prev) => {
      if (prev.has(type)) return prev
      const next = new Set(prev)
      next.add(type)
      return next
    })
  }, [])

  const handleChatError = useCallback(
    () => {
      addAgentMessage({
        content:
          '에이전트 응답 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.\n\n서버가 시작 중이거나 네트워크 상태를 확인해주세요.',
        confirmButtons: [{ label: '다시 시도', variant: 'outline', action: 'retry_chat' }],
        isError: true,
      })
    },
    [addAgentMessage],
  )

  const {
    chatMessages,
    input,
    setInput,
    append,
    setMessages,
    isLoading,
    agentStatus,
    startNewAnalysis,
  } =
    useAgentChat({
      onChatError: handleChatError,
      onCategoryMissing: promptIndustrySelection,
      onAssistantFinish: ({ kind }) => {
        if (kind === 'explore') {
          setExplorationState((prev) => ({ ...prev, questionAsked: true }))
          explorationStateRef.current = { ...explorationStateRef.current, questionAsked: true }
          return
        }

        if (kind === 'reply') {
          const state = explorationStateRef.current
          if (state.questionAsked && state.userResponded) {
            maybeOfferReport('dialog')
          }
          return
        }

        if (kind === 'report') {
          return
        }
      },
    })

  const appendBootstrapConversation = useCallback(
    (locationLabel: string) => {
      const userMessage: UIMessage = {
        id: `bootstrap-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        parts: [
          {
            type: 'text',
            text: `현재 위치(${locationLabel})에서 창업을 준비 중이에요.`,
          },
        ],
      }

      const assistantMessage: UIMessage = {
        id: `bootstrap-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '어떤 업종을 생각하고 계신가요?',
          },
        ],
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
    },
    [setMessages],
  )

  const decoratedChatMessages = useMemo(
    () =>
      chatMessages.map((message) => {
        if (message.role !== 'agent' || message.messageType) {
          return message
        }

        const inferredType = inferExplorationMessageType(message.content)
        return inferredType ? { ...message, messageType: inferredType } : message
      }),
    [chatMessages],
  )

  const handleGenerateReport = useCallback(
    async (
      kind: 'report' | 'regenerate_report' = 'report',
      options?: { appendPrompt?: boolean },
    ) => {
      requestReportRefresh(makeReportRequestSnapshot())

      if (kind === 'report' && reportOfferIdRef.current) {
        disableQuickActionMessage(reportOfferIdRef.current)
      }

      if (kind === 'regenerate_report' && locationChangeNoticeIdRef.current) {
        setLocalMessages((prev) =>
          prev.map((message) =>
            message.id === locationChangeNoticeIdRef.current
              ? { ...message, confirmedAction: 'regenerate_report' }
              : message,
          ),
        )
      }

      onOpenReportTab?.()
      onReportAnnouncementVisibleChange?.(false)
      if (options?.appendPrompt !== false) {
        void append(
          kind === 'report' ? '리포트를 생성해줘.' : '새 리포트를 다시 생성해줘.',
          undefined,
          { kind: 'report', source: 'user_input' },
        )
      }
    },
    [
      append,
      disableQuickActionMessage,
      makeReportRequestSnapshot,
      onOpenReportTab,
      onReportAnnouncementVisibleChange,
    ],
  )

  const handleRegenerateReport = useCallback(() => {
    void handleGenerateReport('regenerate_report')
  }, [handleGenerateReport])

  const maybeOfferReport = useCallback(
    (reason: 'dialog' | 'radius' | 'explicit') => {
      const state = explorationStateRef.current
      if (state.reportOffered && reason !== 'explicit') return

      const existingOfferId = reportOfferIdRef.current
      if (existingOfferId) {
        disableQuickActionMessage(existingOfferId)
        reportOfferIdRef.current = null
      }

      const id = addAgentMessage({
        content: '지금까지 살펴본 내용을 바탕으로 상세 리포트를 생성해드릴까요?',
        messageType: 'report_offer',
      })
      reportOfferIdRef.current = id
      setExplorationState((prev) => ({ ...prev, reportOffered: true }))

      if (reason === 'explicit' && state.reportOffered) {
        void handleGenerateReport('report', { appendPrompt: false })
      }
    },
    [addAgentMessage, disableQuickActionMessage, handleGenerateReport],
  )

  const dismissReportOffer = useCallback(() => {
    if (reportOfferIdRef.current) {
      disableQuickActionMessage(reportOfferIdRef.current)
    }
  }, [disableQuickActionMessage])

  const dismissLocationChangeNotice = useCallback(() => {
    onReportAnnouncementVisibleChange?.(false)
    if (locationChangeNoticeIdRef.current) {
      setLocalMessages((prev) =>
        prev.map((message) =>
          message.id === locationChangeNoticeIdRef.current
            ? { ...message, confirmedAction: 'dismiss_location_change' }
            : message,
        ),
      )
    }
  }, [onReportAnnouncementVisibleChange])

  useEffect(() => {
    const wasLoading = prevChatLoadingRef.current
    prevChatLoadingRef.current = isLoading

    if (wasLoading && !isLoading) {
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
      if (!isMobile) {
        chatInputRef.current?.focus()
      }
    }
  }, [isLoading])

  const { runAnalysis, isLoading: analysisLoading, retry } = useAnalysis({
    onAgentMessage: addAgentMessage,
  })
  const confirmedPosition = analysisContext.confirmedPosition
  const centerLat = confirmedPosition?.lat ?? null
  const centerLng = confirmedPosition?.lng ?? null

  const analysisSignature = useMemo(() => {
    const industry = analysisContext.industry ?? ''
    const radius = analysisContext.radius ?? ''

    if (centerLat != null && centerLng != null) {
      return `${industry}|${radius}|center:${centerLat.toFixed(6)},${centerLng.toFixed(6)}`
    }

    return `${industry}|${radius}|location:${analysisContext.location ?? ''}`
  }, [analysisContext.industry, analysisContext.location, analysisContext.radius, centerLat, centerLng])

  // 에이전트가 업종·위치 컨텍스트를 파싱하면 자동으로 데이터 조회 시작
  // 핀 이동으로 location이 바뀌거나, 같은 location 안에서 center가 바뀌면 재분석한다.
  useEffect(() => {
    const industry = analysisContext.industry
    const location = analysisContext.location
    if (!isValidCategory(industry) || !location) return
    if (analysisRunInFlightRef.current) return
    if (lastAnalysisSignatureRef.current === analysisSignature) return
    if (!confirmedPosition) return

    analysisRunInFlightRef.current = true
    lastAnalysisSignatureRef.current = analysisSignature
    void (async () => {
      try {
        await runAnalysis({
          위치: location,
          업종: industry,
          반경: analysisContext.radius ?? undefined,
          lat: centerLat ?? undefined,
          lng: centerLng ?? undefined,
          행정동코드: confirmedPosition.dongCode,
          locationSource: analysisContext.locationSource,
        })
      } finally {
        analysisRunInFlightRef.current = false
      }
    })()
  }, [
    analysisSignature,
    analysisContext.industry,
    analysisContext.location,
    analysisContext.radius,
    analysisContext.locationSource,
    confirmedPosition,
    centerLat,
    centerLng,
    runAnalysis,
  ])

  useEffect(() => {
    const nextLocation = analysisContext.location
    const nextIndustry = analysisContext.industry
    const nextRadius = analysisContext.radius
    const hasContext = Boolean(nextLocation && isValidCategory(nextIndustry))

    if (!hasContext) {
      prevLocationRef.current = nextLocation
      prevIndustryRef.current = nextIndustry
      prevRadiusRef.current = nextRadius
      return
    }

    if (!hasSeenAnalysisContextRef.current) {
      hasSeenAnalysisContextRef.current = true
      prevLocationRef.current = nextLocation
      prevIndustryRef.current = nextIndustry
      prevRadiusRef.current = nextRadius
      return
    }

    const locationChanged = prevLocationRef.current !== nextLocation
    const industryChanged = prevIndustryRef.current !== nextIndustry
    const radiusChanged = prevRadiusRef.current !== nextRadius && nextRadius != null

    if (locationChanged || industryChanged) {
      resetExplorationState()
    } else if (radiusChanged) {
      setExplorationState((prev) => ({ ...prev, radiusChanged: true }))
      explorationStateRef.current = { ...explorationStateRef.current, radiusChanged: true }
      beginMapUpdate('radius-change')
    }

    prevLocationRef.current = nextLocation
    prevIndustryRef.current = nextIndustry
    prevRadiusRef.current = nextRadius
  }, [
    analysisContext.industry,
    analysisContext.location,
    analysisContext.radius,
    analysisContext.locationSource,
    maybeOfferReport,
    resetExplorationState,
  ])

  useEffect(() => {
    const generatedAt = report?.meta.generated_at ?? null

    if (!generatedAt) {
      reportAnnouncementPendingRef.current = null
      reportAnnouncedRef.current = null
      reportAnnouncementIdRef.current = null
      onReportAnnouncementVisibleChange?.(false)
      return
    }

    if (isLoading) {
      reportAnnouncementPendingRef.current = generatedAt
      return
    }

    const shouldAnnounce =
      reportAnnouncedRef.current !== generatedAt ||
      reportAnnouncementPendingRef.current === generatedAt

    if (shouldAnnounce) {
      const id = addAgentMessage({
        content:
          '분석이 완료되었습니다. 리포트에서 경쟁 현황, 생활인구, 고객 분석 결과를 확인하세요.',
        confirmButtons: [{ label: '리포트 확인하기', variant: 'primary', action: 'open_report' }],
      })
      reportAnnouncementIdRef.current = id
      reportAnnouncedRef.current = generatedAt
      reportAnnouncementPendingRef.current = null
      onReportAnnouncementVisibleChange?.(true)
    }
  }, [report, isLoading, addAgentMessage, onReportAnnouncementVisibleChange])

  const [initMessage, setInitMessage] = useState<AgentMessage>(() => ({
    ...INITIAL_MESSAGE,
    isError: false,
  }))
  const [showQuickStart, setShowQuickStart] = useState(false)

  useLayoutEffect(() => {
    const combined = [initMessage, ...decoratedChatMessages, ...localMessages]
    for (const message of combined) {
      assignMessageOrder(message.id)
    }
  }, [assignMessageOrder, decoratedChatMessages, initMessage, localMessages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const explicitReportRequest = hasExplicitReportRequest(trimmed)
    const latestAssistantMessage = [initMessage, ...decoratedChatMessages, ...localMessages]
      .filter((message): message is AgentMessage => message.role === 'agent')
      .at(-1)
    const latestQuestionType = latestAssistantMessage
      ? detectQuickReplyType(latestAssistantMessage.content)
      : null
    if (latestQuestionType) {
      markQuickReplyTypeUsed(latestQuestionType)
    }
    if (explorationStateRef.current.questionAsked) {
      setExplorationState((prev) => ({ ...prev, userResponded: true }))
      explorationStateRef.current = { ...explorationStateRef.current, userResponded: true }
    }

    setShowQuickStart(false)
    setLocalMessages([])
      void append(trimmed, undefined, {
        kind: explicitReportRequest ? 'report' : 'reply',
        source: 'user_input',
      })

    if (explicitReportRequest) {
      if (explorationStateRef.current.reportOffered) {
        void handleGenerateReport('report', { appendPrompt: false })
      } else {
        maybeOfferReport('explicit')
      }
    }
  }

  const handleQuickStart = (location: string, category: string) => {
    setShowQuickStart(false)
    resetExplorationState()
    setHiddenIndustryPromptId(null)
    startNewAnalysis()
    setInitMessage({ ...INITIAL_MESSAGE, isError: false })

    const quickStartRadius = analysisContext.radius ?? 500
    const radiusText = `반경 ${quickStartRadius}m 내`
    const quickStartText = `${location}에서 ${category} 창업을 준비 중이에요. ${radiusText} 상권을 분석해주세요.`

    void append(
      quickStartText,
      {
        location,
        industry: category,
        radius: quickStartRadius,
      },
      { kind: 'explore', category, source: 'quickstart' },
    )
  }

  const handleIndustryQuickSelect = useCallback(
    (text: string, messageId: string) => {
      const position = confirmedPositionRef.current
      if (!position) {
        console.warn('[chat] 위치 미확정 상태에서 업종 선택됨')
        return
      }

      setHiddenIndustryPromptId(messageId)
      setShowQuickStart(false)
      void append(
        text,
        {
          confirmedPosition: position,
          location: position.dongName,
          dongCode: position.dongCode,
        },
        { kind: 'reply', category: text, source: 'user_input' },
      )
    },
    [append],
  )

  const handleQuickReplySelect = useCallback(
    (
      messageId: string,
      type: QuickReplyType,
      option: { label: string; text: string; action?: 'generate_report' | 'dismiss' },
    ) => {
      disableQuickActionMessage(messageId)
      setShowQuickStart(false)

      setExplorationState((prev) => ({ ...prev, userResponded: true }))
      explorationStateRef.current = { ...explorationStateRef.current, userResponded: true }
      markQuickReplyTypeUsed(type)

      if (option.action === 'generate_report') {
        void handleGenerateReport('report')
        return
      }

      if (option.action === 'dismiss') {
        return
      }

      if (type === 'radius' || (type === 'report_offer' && option.text.includes('반경'))) {
        setExplorationState((prev) => ({ ...prev, radiusChanged: true }))
        explorationStateRef.current = { ...explorationStateRef.current, radiusChanged: true }
      }

      void append(option.text, undefined, { kind: 'reply', source: 'user_input' })
    },
    [append, disableQuickActionMessage, handleGenerateReport, markQuickReplyTypeUsed],
  )

  const handleExplorationQuickSelect = useCallback(
    (
      messageId: string,
      type: ExplorationMessageType,
      value: string | number,
    ) => {
      disableQuickActionMessage(messageId)
      setShowQuickStart(false)

      const markResponded = () => {
        setExplorationState((prev) => ({ ...prev, userResponded: true }))
        explorationStateRef.current = { ...explorationStateRef.current, userResponded: true }
      }

      if (type === 'ask_radius') {
        const nextRadius = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(nextRadius)) return

        markResponded()
        setExplorationState((prev) => ({ ...prev, radiusChanged: true }))
        explorationStateRef.current = { ...explorationStateRef.current, radiusChanged: true }
        setAnalysisContext({ radius: nextRadius })
        void append(`${nextRadius}m로 반경을 바꿔볼게요.`, undefined, {
          kind: 'reply',
          source: 'user_input',
        })
        return
      }

      if (type === 'ask_population') {
        const labelMap: Record<string, string> = {
          commute: '출퇴근 시간대',
          lunch: '점심 시간대',
          evening: '저녁 시간대',
          weekend: '주말',
        }
        const slot = labelMap[String(value)]
        if (!slot) return

        markResponded()
        void append(`${slot} 유동인구가 궁금해요.`, undefined, {
          kind: 'reply',
          source: 'user_input',
        })
        return
      }

      if (type === 'competition') {
        markResponded()

        if (value === 'report') {
          maybeOfferReport('explicit')
          return
        }

        if (value === 'radius') {
          setExplorationState((prev) => ({ ...prev, radiusChanged: true }))
          explorationStateRef.current = { ...explorationStateRef.current, radiusChanged: true }
          void append('반경을 바꿔볼게요.', undefined, {
            kind: 'reply',
            source: 'user_input',
          })
          return
        }

        if (value === 'map') {
          void append('지도에서 직접 확인할게요.', undefined, {
            kind: 'reply',
            source: 'user_input',
          })
          return
        }
      }

      if (type === 'report_offer') {
        if (value === 'generate') {
          void handleGenerateReport('report')
          return
        }

        if (value === 'explore_more') {
          markResponded()
          setExplorationState((prev) => ({ ...prev, radiusChanged: true }))
          explorationStateRef.current = { ...explorationStateRef.current, radiusChanged: true }
          void append('반경을 더 바꿔볼게요.', undefined, {
            kind: 'reply',
            source: 'user_input',
          })
          return
        }

        if (value === 'dismiss') {
          markResponded()
          disableQuickActionMessage(messageId)
        }
      }
    },
    [append, disableQuickActionMessage, handleGenerateReport, maybeOfferReport, setAnalysisContext],
  )

  const handleConfirmAction = useCallback(
    async (action: string) => {
      switch (action) {
        case 'open_report':
          if (reportAnnouncementIdRef.current) {
            setLocalMessages((prev) =>
              prev.map((message) =>
                message.id === reportAnnouncementIdRef.current
                  ? { ...message, confirmedAction: action }
                  : message,
              ),
            )
          }
          onOpenReportTab?.()
          onReportAnnouncementVisibleChange?.(false)
          break

        case 'generate_report':
          void handleGenerateReport('report')
          break

        case 'dismiss_report_offer':
          dismissReportOffer()
          break

        case 'regenerate_report':
          handleRegenerateReport()
          break

        case 'dismiss_location_change':
          dismissLocationChangeNotice()
          break

        case 'retry_analysis':
          setLocalMessages([])
          retry()
          break

        case 'retry_chat':
          // 마지막 사용자 메시지를 다시 전송
          setLocalMessages([])
          document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
          break

        case 'retry_input':
          setLocalMessages([])
          document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
          break

        case 'cancel':
          setLocalMessages([])
          break

        case 'use_current_location': {
          setInitMessage((prev) => ({ ...prev, confirmedAction: action }))
          const pos = await requestLocation()

          if (pos) {
            setAnalysisContext({
              userLocation: pos,
              confirmedPosition: null,
              center: null,
            })

            const confirmed = await confirmPosition(pos.lat, pos.lng)

            if (confirmed) {
              confirmedPositionRef.current = confirmed
              setAnalysisContext({
                userLocation: pos,
                confirmedPosition: confirmed,
                location: confirmed.dongName,
                locationSource: 'geolocation',
                dongCode: confirmed.dongCode,
              })
              appendBootstrapConversation(confirmed.dongName)
            } else {
              // 역지오코딩 실패 → 좌표 텍스트 fallback
              const fallbackPosition: ConfirmedPosition = {
                lat: pos.lat,
                lng: pos.lng,
                dongName: '현재 위치',
                dongCode: '',
              }
              confirmedPositionRef.current = fallbackPosition
              setAnalysisContext({
                userLocation: pos,
                confirmedPosition: fallbackPosition,
                location: fallbackPosition.dongName,
                locationSource: 'geolocation',
                dongCode: fallbackPosition.dongCode,
              })
              appendBootstrapConversation(`좌표: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`)
            }
          } else {
            void append('위치 권한을 허용하지 않았어요.', undefined, { kind: 'reply', source: 'system' })
          }

          setShowQuickStart(true)
          document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
          break
        }

        case 'input_manually':
          setInitMessage((prev) => ({ ...prev, confirmedAction: action }))
          resetExplorationState()
          setAnalysisContext({
            confirmedPosition: null,
            center: null,
            userLocation: null,
            location: null,
            locationSource: null,
            dongCode: null,
            fullLocationName: null,
          })
          setShowQuickStart(true)
          document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
          break

        default: {
          const actionTextMap: Record<string, string> = {
            change_radius_300: '네, 300m로 변경해주세요.',
            keep_radius_500: '500m로 유지할게요.',
          }

          if (action === 'change_radius_300') {
            setAnalysisContext({ radius: 300 })
          }

          if (action === 'keep_radius_500') {
            setAnalysisContext({ radius: 500 })
          }

          void append(actionTextMap[action] ?? action, undefined, {
            kind: 'reply',
            source: 'user_input',
          })
          break
        }
      }
    },
    [
      retry,
      append,
      requestLocation,
      confirmPosition,
      setInitMessage,
      setShowQuickStart,
      setAnalysisContext,
      setLocalMessages,
      onOpenReportTab,
      onReportAnnouncementVisibleChange,
      handleGenerateReport,
      dismissReportOffer,
      handleRegenerateReport,
      dismissLocationChangeNotice,
      resetExplorationState,
      appendBootstrapConversation,
    ],
  )

  // SDK 메시지 + 로컬 에러 메시지 병합
  const allMessages = useMemo(
    () => {
      const combined = [initMessage, ...decoratedChatMessages, ...localMessages]
      return combined.sort((a, b) => {
        const orderA = messageOrderById[a.id] ?? 0
        const orderB = messageOrderById[b.id] ?? 0
        return orderA - orderB
      }) as ChatMessage[]
    },
    [decoratedChatMessages, initMessage, localMessages, messageOrderById],
  )

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={agentStatus} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          messages={allMessages}
          onConfirmAction={handleConfirmAction}
          onIndustryQuickSelect={handleIndustryQuickSelect}
          onExplorationQuickSelect={handleExplorationQuickSelect}
          onQuickReplySelect={handleQuickReplySelect}
          disabledQuickActionIds={disabledQuickActionIds}
          usedQuickReplyTypes={usedQuickReplyTypes}
          hiddenIndustryPromptId={hiddenIndustryPromptId}
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
        ref={chatInputRef}
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading || analysisLoading}
        placeholder={
          analysisLoading ? '분석 중…' : isLoading ? '응답 중…' : '업종과 위치를 입력하세요…'
        }
      />
      <Disclaimer />
    </div>
  )
}
