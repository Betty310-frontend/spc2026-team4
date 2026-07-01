'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAnalysisContext } from '@/store/analysisContext'
import { useAnalysisResult, abortMapUpdate, clearReportData } from '@/store/analysisResult'
import {
  fetchCompetitors,
  fetchPopulation,
  fetchCompetitionPercentile,
  fetchH3Hexagons,
} from '@/lib/api-client'
import { applyCompetitors, normalizeCompetitors } from '@/lib/agent-event-bridge'
import { isValidCategory } from '@/lib/category'
import { resolveLocationToCenter } from '@/lib/geocode'
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
  locationSource?: 'user_input' | 'quickstart' | 'geolocation' | null
}

function getH3Resolution(radiusM: number): 8 | 9 | 10 {
  if (radiusM <= 300) return 10
  if (radiusM <= 700) return 9
  return 8
}

function clampH3Resolution(value: number): 7 | 8 | 9 | 10 {
  if (value <= 7) return 7
  if (value >= 10) return 10
  return value as 8 | 9 | 10
}

interface UseAnalysisOptions {
  onAgentMessage?: (message: Omit<AgentMessage, 'id' | 'role'>) => void
}

export function useAnalysis(options: UseAnalysisOptions = {}) {
  const { confirmPosition } = useAnalysisContext()
  const {
    updateMetric,
    setMapOptions,
    setH3Hexagons,
    setH3Resolution,
    startLoading,
    stopLoading,
    isLoading,
  } = useAnalysisResult()
  const lastParamsRef = useRef<AnalysisParams | null>(null)

  // options를 ref로 캡처해 useCallback 의존성 안정화
  const onAgentMessageRef = useRef(options.onAgentMessage)
  useEffect(() => {
    onAgentMessageRef.current = options.onAgentMessage
  }, [options.onAgentMessage])

  const runAnalysis = useCallback(
    async (params: AnalysisParams) => {
      lastParamsRef.current = params
      clearReportData()

      if (!isValidCategory(params.업종)) {
        setH3Hexagons([])
        setH3Resolution(null)
        return
      }

      updateMetric('competitors', { status: 'loading' })
      updateMetric('population', { status: 'loading' })
      updateMetric('density', { status: 'loading' })
      setH3Hexagons([])
      setH3Resolution(null)

      startLoading('analysis')
      try {
        let resolvedCenter =
          params.lat != null && params.lng != null
            ? { lat: params.lat, lng: params.lng }
            : null
        let confirmedPosition:
          | Awaited<ReturnType<typeof confirmPosition>>
          | null = null

        if (!resolvedCenter) {
          if (
            params.locationSource !== 'user_input' &&
            params.locationSource !== 'quickstart' &&
            params.locationSource !== 'geolocation'
          ) {
            throw new ApiError(400, '허용되지 않은 위치 출처입니다.')
          }

          const locationResult = await resolveLocationToCenter(params.위치)
          if (!locationResult) {
            throw new ApiError(400, '위치 좌표를 찾지 못했습니다.')
          }

          resolvedCenter = locationResult.center
        }

        if (params.lat != null && params.lng != null && params.행정동코드) {
          confirmedPosition = {
            lat: resolvedCenter.lat,
            lng: resolvedCenter.lng,
            dongName: params.위치,
            dongCode: params.행정동코드,
          }
        } else {
          confirmedPosition = await confirmPosition(resolvedCenter.lat, resolvedCenter.lng)
          if (!confirmedPosition) {
            throw new ApiError(400, '좌표의 지역 정보를 찾지 못했습니다.')
          }
        }

        const h3Resolution = clampH3Resolution(getH3Resolution(params.반경 ?? 500))
        const compPromise = fetchCompetitors({
          위치: params.위치,
          업종: params.업종,
          반경: params.반경,
          lat: resolvedCenter.lat,
          lng: resolvedCenter.lng,
        }).then((comp) => {
          applyCompetitors(normalizeCompetitors(comp))
        }).catch(() => {
          updateMetric('competitors', { status: 'error' })
        })

        const densityPromise = fetchCompetitionPercentile({
          lat: resolvedCenter.lat,
          lng: resolvedCenter.lng,
          업종: params.업종,
          반경: params.반경,
        }).then((d) => {
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
          updateMetric('competitors', {
            badge: densityBadge,
            badgeTier: d.tier as 'high' | 'mid' | 'low',
          })
        }).catch(() => {
          updateMetric('density', { status: 'error' })
        })

        const h3Promise = fetchH3Hexagons({
          lat: resolvedCenter.lat,
          lng: resolvedCenter.lng,
          category: params.업종,
          radius: params.반경,
          resolution: h3Resolution,
        }).then((hexagons) => {
          setH3Hexagons(hexagons)
          setH3Resolution(h3Resolution)
        }).catch(() => {
          setH3Hexagons([])
          setH3Resolution(null)
        })

        const populationPromise = fetchPopulation({
          행정동코드: params.행정동코드 ?? confirmedPosition.dongCode,
          업종: params.업종,
          // 시간대: ['11'],
        })
          .then((p) => {
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
          })
          .catch(() => {
            updateMetric('population', {
              status: 'fallback',
              value: '데이터 준비중',
              unit: '',
              isFallback: true,
              hint: '시간대별 생활인구 곡선으로 대체 판단하세요',
            })
          })

        await Promise.allSettled([compPromise, densityPromise, populationPromise, h3Promise])
      } catch (err) {
        abortMapUpdate()
        setH3Hexagons([])
        setH3Resolution(null)

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
    [confirmPosition, setH3Hexagons, setH3Resolution, startLoading, stopLoading, updateMetric],
  )

  const retry = useCallback(() => {
    if (lastParamsRef.current) runAnalysis(lastParamsRef.current)
  }, [runAnalysis])

  const reset = useCallback(() => {
    abortMapUpdate()
    clearReportData()
    setMapOptions(null)
    setH3Hexagons([])
    setH3Resolution(null)
    lastParamsRef.current = null
  }, [setH3Hexagons, setH3Resolution, setMapOptions])

  return { runAnalysis, isLoading, retry, reset }
}
