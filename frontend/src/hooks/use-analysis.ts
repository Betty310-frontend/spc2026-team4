'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'
import { useAnalysisResult, abortMapUpdate } from '@/store/analysisResult'
import { fetchCompetitors, fetchPopulation, fetchCompetitionPercentile } from '@/lib/api-client'
import { applyCompetitors, normalizeCompetitors } from '@/lib/agent-event-bridge'
import { isValidCategory } from '@/lib/category'
import { reverseGeocode, resolveLocationToCenter } from '@/lib/geocode'
import { getTierBadgeLabel } from '@/lib/metric-badge'
import { getApiErrorMessage } from '@/constants/error-messages'
import { formatNumber, formatPopulation } from '@/lib/number-format'
import type { AgentMessage } from '@/types/message'
import { ApiError } from '@/lib/retry'

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
  const { setAnalysisContext } = useAnalysisContext()
  const { updateMetric, setMapOptions, startLoading, stopLoading, isLoading } = useAnalysisResult()
  const lastParamsRef = useRef<AnalysisParams | null>(null)
  const setAnalysisContextRef = useRef(setAnalysisContext)

  // options를 ref로 캡처해 useCallback 의존성 안정화
  const onAgentMessageRef = useRef(options.onAgentMessage)
  useEffect(() => {
    onAgentMessageRef.current = options.onAgentMessage
  }, [options.onAgentMessage])

  useEffect(() => {
    setAnalysisContextRef.current = setAnalysisContext
  }, [setAnalysisContext])

  const runAnalysis = useCallback(
    async (params: AnalysisParams) => {
      lastParamsRef.current = params

      if (!isValidCategory(params.업종)) {
        return
      }

      updateMetric('competitors', { status: 'loading' })
      updateMetric('population', { status: 'loading' })
      updateMetric('density', { status: 'loading' })

      startLoading('analysis')
      try {
        let resolvedCenter =
          params.lat != null && params.lng != null
            ? { lat: params.lat, lng: params.lng }
            : null

        if (!resolvedCenter) {
          const locationResult = await resolveLocationToCenter(params.위치)
          if (!locationResult) {
            throw new ApiError(400, '위치 좌표를 찾지 못했습니다.')
          }

          resolvedCenter = locationResult.center
          setAnalysisContextRef.current({
            center: resolvedCenter,
            fullLocationName: locationResult.label,
          })
        } else {
          setAnalysisContextRef.current({
            center: resolvedCenter,
          })
        }

        // Step 1: 경쟁업체 조회 (확정 좌표 사용)
        const comp = await fetchCompetitors({
          위치: params.위치,
          업종: params.업종,
          반경: params.반경,
          lat: resolvedCenter.lat,
          lng: resolvedCenter.lng,
        })

        applyCompetitors(normalizeCompetitors(comp))

        let populationDongCode = params.행정동코드 ?? null
        if (!populationDongCode) {
          const geoResult = await reverseGeocode(resolvedCenter.lat, resolvedCenter.lng)
          if (geoResult?.dongCode) {
            populationDongCode = geoResult.dongCode
            setAnalysisContextRef.current({
              dongCode: geoResult.dongCode,
              fullLocationName: geoResult.fullName,
            })
          }
        }

        // Step 2: density + population 병렬 조회
        const [density, pop] = await Promise.allSettled([
          fetchCompetitionPercentile({
            lat: resolvedCenter.lat,
            lng: resolvedCenter.lng,
            업종: params.업종,
            반경: params.반경,
          }),
          populationDongCode
            ? fetchPopulation({
                행정동코드: populationDongCode,
                업종: params.업종,
                // 시간대: ['11'],
              })
            : Promise.reject(new Error('행정동코드 없음')),
        ])

        if (density.status === 'fulfilled') {
          const d = density.value
          const densityBadge = d.label || getTierBadgeLabel(d.percentile) || undefined
          updateMetric('density', {
            status: d.fallback ? 'fallback' : 'done',
            value: formatNumber(d.percentile),
            unit: 'P',
            badge: densityBadge,
            badgeTier: d.tier as 'high' | 'mid' | 'low',
            source: `${d.data_source} · ${d.base_date}`,
            isFallback: d.fallback,
          })
          // 경쟁업체 카드 배지도 density 결과로 보강
          updateMetric('competitors', {
            badge: densityBadge,
            badgeTier: d.tier as 'high' | 'mid' | 'low',
          })
        } else {
          // 부분 에러 — 카드만 error 표시, 에이전트 메시지 없음
          updateMetric('density', { status: 'error' })
        }

        if (pop.status === 'fulfilled') {
          const p = pop.value
          const percentile = p.percentile
          const populationBadge = getTierBadgeLabel(percentile) || undefined
          updateMetric('population', {
            status: p.fallback ? 'fallback' : 'done',
            value: p.weighted_avg == null ? '데이터 준비중' : formatPopulation(p.weighted_avg),
            unit: p.weighted_avg == null ? '' : '명',
            badge: populationBadge,
            badgeTier:
              percentile == null
                ? undefined
                : percentile >= 70
                  ? 'high'
                  : percentile >= 40
                    ? 'mid'
                    : 'low',
            source: `${p.data_source} · ${p.base_date}`,
            isFallback: p.fallback,
            hint: p.weighted_avg == null ? '시간대별 생활인구 곡선으로 대체 판단하세요' : undefined,
          })
        } else {
          // 행정동코드 없으면 fallback 처리
          updateMetric('population', {
            status: 'fallback',
            value: '데이터 준비중',
            unit: '',
            isFallback: true,
            hint: '시간대별 생활인구 곡선으로 대체 판단하세요',
          })
        }
      } catch (err) {
        abortMapUpdate()

        // 치명적 에러 (competitors 실패) → 에이전트 에러 메시지로 전달
        updateMetric('competitors', { status: 'error' })
        updateMetric('population', { status: 'error' })
        updateMetric('density', { status: 'error' })

        const errorMsg = getApiErrorMessage(err, 'competitors')
        onAgentMessageRef.current?.({
          content: errorMsg.content,
          confirmButtons: errorMsg.confirmButtons,
          isError: true,
        })
      } finally {
        stopLoading('analysis')
      }
    },
    [startLoading, stopLoading, updateMetric],
  )

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
