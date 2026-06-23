/**
 * [DEV ONLY] 목업 분석 훅 — 서버 개발 완료 후 제거
 * 실제 에이전트 연동(useAgentChat)으로 대체됨
 * 제거 시 app/page.tsx의 useMockAnalysis 임포트 및 테스트 버튼도 함께 제거
 */

'use client'

import { useState } from 'react'
import { useAnalysisResult } from '@/store/analysisResult'
import { useAnalysisContext } from '@/store/analysisContext'
import { MapOptions } from '@/types/map'
import {
  CompetitorsResponse,
  PopulationResponse,
  CompetitionPercentileResponse,
} from '@/types/api'

export function useMockAnalysis() {
  const { updateMetric } = useAnalysisResult()
  const { setAnalysisContext } = useAnalysisContext()
  const [mapOptions, setMapOptions] = useState<MapOptions | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // count: 경쟁업체 수 (기본 5, 클러스터 테스트 시 50 이상)
  const runMockAnalysis = async (count = 5) => {
    setIsLoading(true)

    setAnalysisContext({ industry: '카페', location: '연남동', radius: 500 })

    updateMetric('competitors', { status: 'loading' })
    updateMetric('population', { status: 'loading' })
    updateMetric('density', { status: 'loading' })

    const [comp, pop, density] = await Promise.all([
      fetch(`/api/mock/competitors?count=${count}`).then((r) => r.json()) as Promise<CompetitorsResponse>,
      fetch('/api/mock/population').then((r) => r.json()) as Promise<PopulationResponse>,
      fetch('/api/mock/competition-percentile').then(
        (r) => r.json(),
      ) as Promise<CompetitionPercentileResponse>,
    ])

    setMapOptions({
      center: comp.center,
      radius_m: comp.radius_m,
      competitors: comp.data,
    })

    updateMetric('competitors', {
      status: 'done',
      value: `${comp.same_type}곳`,
      badge: density.label,
      badgeTier: comp.tier,
      source: `${comp.data_source} · ${comp.base_date}`,
      isFallback: comp.fallback,
    })

    updateMetric('population', {
      status: 'done',
      value: `${pop.percentile}P`,
      badge: `서울 상위 ${100 - pop.percentile}%`,
      badgeTier: pop.percentile >= 70 ? 'high' : pop.percentile >= 40 ? 'mid' : 'low',
      source: `${pop.data_source} · ${pop.time_range}`,
      isFallback: pop.fallback,
    })

    updateMetric('density', {
      status: 'done',
      value: `${density.percentile}P`,
      badge: density.label,
      badgeTier: density.tier,
      source: `${density.data_source} · ${density.base_date}`,
      isFallback: density.fallback,
    })

    setIsLoading(false)
  }

  return { runMockAnalysis, mapOptions, isLoading }
}
