'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
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
import type { AgentMessage } from '@/types/message'
import { INITIAL_MESSAGE } from '@/constants/messages'
import { reverseGeocode } from '@/lib/geocode'
import { beginMapUpdate } from '@/store/analysisResult'
import { isValidCategory } from '@/lib/category'

interface AgentPanelProps {
  onOpenReportTab?: () => void
  onReportAnnouncementVisibleChange?: (visible: boolean) => void
}

export function AgentPanel({
  onOpenReportTab,
  onReportAnnouncementVisibleChange,
}: AgentPanelProps) {
  const { status: geoStatus, requestLocation } = useGeolocation()
  const { analysisContext, setAnalysisContext } = useAnalysisContext()
  const { report } = useAnalysisResult()

  // 에러 전용 로컬 메시지 (LLM 호출 없이 즉시 삽입)
  const [localMessages, setLocalMessages] = useState<AgentMessage[]>([])
  const reportAnnouncementIdRef = useRef<string | null>(null)
  const reportAnnouncementPendingRef = useRef<string | null>(null)
  const reportAnnouncedRef = useRef<string | null>(null)
  const [hiddenIndustryPromptId, setHiddenIndustryPromptId] = useState<string | null>(null)

  const addAgentMessage = useCallback((msg: Omit<AgentMessage, 'id' | 'role'>) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setLocalMessages((prev) => [
      ...prev,
      { id, role: 'agent' as const, ...msg },
    ])
    return id
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

  const { chatMessages, input, setInput, append, isLoading, agentStatus, startNewAnalysis } =
    useAgentChat({ onChatError: handleChatError })

  const { runAnalysis, isLoading: analysisLoading, retry } = useAnalysis({
    onAgentMessage: addAgentMessage,
  })
  const prevRadiusRef = useRef<number | null>(analysisContext.radius)
  const prevLocationRef = useRef<string | null>(analysisContext.location)
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(analysisContext.center)
  const lastAnalysisSignatureRef = useRef<string | null>(null)
  const centerLat = analysisContext.center?.lat ?? null
  const centerLng = analysisContext.center?.lng ?? null

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
    if (!isValidCategory(industry) || !analysisContext.location) return
    if (lastAnalysisSignatureRef.current === analysisSignature) return

    lastAnalysisSignatureRef.current = analysisSignature
    runAnalysis({
      위치: analysisContext.location,
      업종: industry,
      반경: analysisContext.radius ?? undefined,
      lat: centerLat ?? undefined,
      lng: centerLng ?? undefined,
      행정동코드: analysisContext.dongCode ?? undefined,
    })
  }, [
    analysisSignature,
    analysisContext.industry,
    analysisContext.location,
    analysisContext.radius,
    analysisContext.dongCode,
    centerLat,
    centerLng,
    runAnalysis,
  ])

  useEffect(() => {
    const prevLocation = prevLocationRef.current
    const nextLocation = analysisContext.location
    const prevCenter = prevCenterRef.current
    const nextCenter = analysisContext.center

    const centerChanged =
      prevCenter != null &&
      nextCenter != null &&
      (prevCenter.lat !== nextCenter.lat || prevCenter.lng !== nextCenter.lng)

    if (prevLocation && nextLocation && prevLocation !== nextLocation && centerChanged) {
      addAgentMessage({
        content: `지역이 ${nextLocation}으로 변경되어 다시 분석 중이에요.`,
      })
    }

    prevLocationRef.current = nextLocation
    prevCenterRef.current = nextCenter
  }, [analysisContext.center, analysisContext.location, addAgentMessage])

  useEffect(() => {
    const prevRadius = prevRadiusRef.current
    const nextRadius = analysisContext.radius

    if (
      prevRadius != null &&
      nextRadius != null &&
      prevRadius !== nextRadius
    ) {
      beginMapUpdate('radius-change')
    }

    prevRadiusRef.current = nextRadius
  }, [analysisContext.radius])

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

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    setShowQuickStart(false)
    setLocalMessages([])
    void append(input)
  }

  const handleQuickStart = (text: string) => {
    setShowQuickStart(false)
    setLocalMessages([])
    setHiddenIndustryPromptId(null)
    startNewAnalysis()
    setInitMessage({ ...INITIAL_MESSAGE, isError: false })
    void append(text)
  }

  const handleIndustryQuickSelect = useCallback(
    (text: string, messageId: string) => {
      setHiddenIndustryPromptId(messageId)
      setShowQuickStart(false)
      setLocalMessages([])
      void append(text)
    },
    [append],
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
              location: null,
              dongCode: null,
              fullLocationName: null,
            })

            // SDK Geocoder로 역지오코딩 — 행정동명·코드 획득
            const geoResult = await reverseGeocode(pos.lat, pos.lng)

            if (geoResult) {
              setAnalysisContext({
                userLocation: pos,
                location: geoResult.dongName,
                dongCode: geoResult.dongCode,
                fullLocationName: geoResult.fullName,
              })
              void append(`현재 위치(${geoResult.fullName})에서 창업을 준비 중이에요.`)
            } else {
              // 역지오코딩 실패 → 좌표 텍스트 fallback
              void append(
                `현재 위치(좌표: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})에서 창업을 준비 중이에요.`,
              )
            }
          } else {
            void append('위치 권한을 허용하지 않았어요.')
          }

          setShowQuickStart(true)
          document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
          break
        }

        case 'input_manually':
          setInitMessage((prev) => ({ ...prev, confirmedAction: action }))
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

          void append(actionTextMap[action] ?? action)
          break
        }
      }
    },
    [
      retry,
      append,
      requestLocation,
      setAnalysisContext,
      onOpenReportTab,
      onReportAnnouncementVisibleChange,
    ],
  )

  // SDK 메시지 + 로컬 에러 메시지 병합
  const allMessages = useMemo(
    () => [initMessage, ...chatMessages, ...localMessages],
    [initMessage, chatMessages, localMessages],
  )

  return (
    <div className="flex h-full flex-col">
      <AgentHeader status={agentStatus} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          messages={allMessages}
          onConfirmAction={handleConfirmAction}
          onIndustryQuickSelect={handleIndustryQuickSelect}
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
