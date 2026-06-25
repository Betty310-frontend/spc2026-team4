'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useAnalysis } from '@/hooks/use-analysis'
import { useAnalysisContext } from '@/store/analysisContext'
import { AgentHeader } from './AgentHeader'
import { MessageThread } from './MessageThread'
import { QuickStartButtons } from './QuickStartButtons'
import { ChatInput } from './ChatInput'
import { Disclaimer } from './Disclaimer'
import type { AgentMessage } from '@/types/message'
import { INITIAL_MESSAGE } from '@/constants/messages'
import { reverseGeocode } from '@/lib/geocode'
import { beginMapUpdate } from '@/store/analysisResult'

export function AgentPanel() {
  const { status: geoStatus, requestLocation } = useGeolocation()
  const { analysisContext, setAnalysisContext } = useAnalysisContext()

  // 에러 전용 로컬 메시지 (LLM 호출 없이 즉시 삽입)
  const [localMessages, setLocalMessages] = useState<AgentMessage[]>([])

  const addAgentMessage = useCallback((msg: Omit<AgentMessage, 'id' | 'role'>) => {
    setLocalMessages((prev) => [
      ...prev,
      { id: `local-${prev.length}-${msg.isError ? 'err' : 'msg'}`, role: 'agent' as const, ...msg },
    ])
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

  // 에이전트가 업종·위치 컨텍스트를 파싱하면 자동으로 데이터 조회 시작
  // radius는 의존성에서 제외 — runAnalysis 내부에서 radius 변경 시 재트리거 방지
  useEffect(() => {
    if (analysisContext.industry && analysisContext.location) {
      runAnalysis({
        위치: analysisContext.location,
        업종: analysisContext.industry,
        반경: analysisContext.radius ?? undefined,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisContext.industry, analysisContext.location, analysisContext.radius])

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

  const [initMessage, setInitMessage] = useState<AgentMessage>(() => ({
    ...INITIAL_MESSAGE,
    isError: false,
  }))
  const [showQuickStart, setShowQuickStart] = useState(false)

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    setShowQuickStart(false)
    setLocalMessages([])
    append(input)
  }

  const handleQuickStart = (text: string) => {
    setShowQuickStart(false)
    setLocalMessages([])
    startNewAnalysis()
    setInitMessage({ ...INITIAL_MESSAGE, isError: false })
    append(text)
  }

  const handleConfirmAction = useCallback(
    async (action: string) => {
      switch (action) {
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
              append(`현재 위치(${geoResult.fullName})에서 창업을 준비 중이에요.`)
            } else {
              // 역지오코딩 실패 → 좌표 텍스트 fallback
              append(
                `현재 위치(좌표: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})에서 창업을 준비 중이에요.`,
              )
            }
          } else {
            append('위치 권한을 허용하지 않았어요.')
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

          append(actionTextMap[action] ?? action)
          break
        }
      }
    },
    [retry, append, requestLocation, setAnalysisContext],
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
