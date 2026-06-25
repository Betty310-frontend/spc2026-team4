'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAnalysisResult, abortMapUpdate } from '@/store/analysisResult'
import {
  fetchCompetitors,
  fetchPopulation,
  fetchCompetitionPercentile,
} from '@/lib/api-client'
import { applyCompetitors, normalizeCompetitors } from '@/lib/agent-event-bridge'
import { getApiErrorMessage } from '@/constants/error-messages'
import type { AgentMessage } from '@/types/message'

export interface AnalysisParams {
  위치: string
  업종: string
  반경?: number
  lat?: number
  lng?: number
  행정동코드?: string
}

interface UseAnalysisOptions {
  onAgentMessage?: (message: Omit<AgentMessage, 'id' | 'role'>) => void
}

export function useAnalysis(options: UseAnalysisOptions = {}) {
  const { updateMetric, setMapOptions } = useAnalysisResult()
  const [isLoading, setIsLoading] = useState(false)
  const lastParamsRef = useRef<AnalysisParams | null>(null)

  // options를 ref로 캡처해 useCallback 의존성 안정화
  const onAgentMessageRef = useRef(options.onAgentMessage)
  useEffect(() => {
    onAgentMessageRef.current = options.onAgentMessage
  }, [options.onAgentMessage])

  const runAnalysis = useCallback(async (params: AnalysisParams) => {
    setIsLoading(true)
    lastParamsRef.current = params
    updateMetric('competitors', { status: 'loading' })
    updateMetric('population',  { status: 'loading' })
    updateMetric('density',     { status: 'loading' })

    try {
      // Step 1: 경쟁업체 조회 (center 좌표 확보)
      const comp = await fetchCompetitors({
        위치: params.위치,
        업종: params.업종,
        반경: params.반경,
        lat: params.lat,
        lng: params.lng,
      })

      applyCompetitors(normalizeCompetitors(comp))

      // Step 2: density + population 병렬 조회
      const [density, pop] = await Promise.allSettled([
        fetchCompetitionPercentile({
          lat: comp.center.lat,
          lng: comp.center.lng,
          업종: params.업종,
          반경: params.반경,
        }),
        params.행정동코드
          ? fetchPopulation({ 행정동코드: params.행정동코드, 업종: params.업종 })
          : Promise.reject(new Error('행정동코드 없음')),
      ])

      if (density.status === 'fulfilled') {
        const d = density.value
        updateMetric('density', {
          status: d.fallback ? 'fallback' : 'done',
          value: `${d.percentile}P`,
          badge: d.label,
          badgeTier: d.tier as 'high' | 'mid' | 'low',
          source: `${d.data_source} · ${d.base_date}`,
          isFallback: d.fallback,
        })
        // 경쟁업체 카드 배지도 density 결과로 보강
        updateMetric('competitors', {
          badge: d.label,
          badgeTier: d.tier as 'high' | 'mid' | 'low',
        })
      } else {
        // 부분 에러 — 카드만 error 표시, 에이전트 메시지 없음
        updateMetric('density', { status: 'error' })
      }

      if (pop.status === 'fulfilled') {
        const p = pop.value
        const percentile = p.percentile ?? 0
        updateMetric('population', {
          status: p.fallback ? 'fallback' : 'done',
          value: `${percentile}P`,
          badge: `서울 상위 ${100 - percentile}%`,
          badgeTier: percentile >= 70 ? 'high' : percentile >= 40 ? 'mid' : 'low',
          source: `${p.data_source} · ${p.base_date}`,
          isFallback: p.fallback,
        })
      } else {
        // 행정동코드 없으면 fallback 처리
        updateMetric('population', { status: 'fallback', value: '—', isFallback: true })
      }
    } catch (err) {
      abortMapUpdate()

      // 치명적 에러 (competitors 실패) → 에이전트 에러 메시지로 전달
      updateMetric('competitors', { status: 'error' })
      updateMetric('population',  { status: 'error' })
      updateMetric('density',     { status: 'error' })

      const errorMsg = getApiErrorMessage(err, 'competitors')
      onAgentMessageRef.current?.({
        content: errorMsg.content,
        confirmButtons: errorMsg.confirmButtons,
        isError: true,
      })
    } finally {
      setIsLoading(false)
    }
  }, [updateMetric])

  const retry = useCallback(() => {
    if (lastParamsRef.current) runAnalysis(lastParamsRef.current)
  }, [runAnalysis])

  const reset = useCallback(() => {
    abortMapUpdate()
    setMapOptions(null)
    lastParamsRef.current = null
  }, [setMapOptions])

  return { runAnalysis, isLoading, retry, reset }
}
