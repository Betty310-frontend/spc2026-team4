'use client'

import dynamic from 'next/dynamic'
import { SplitLayout, LeftPanel } from '@/components/layout'
import { MetricCards } from '@/components/metrics/MetricCards'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useAnalysisResult } from '@/store/analysisResult'
import { useAnalysisContext } from '@/store/analysisContext'

// Kakao Maps SDK는 브라우저 전용. SSR에서 제외해 hydration 타이밍 충돌 방지.
const KakaoMap = dynamic(
  () => import('@/components/map/KakaoMap').then((m) => ({ default: m.KakaoMap })),
  { ssr: false },
)

export default function Home() {
  // mapOptions는 useAnalysis → setMapOptions → 스토어에서 공유
  const { mapOptions } = useAnalysisResult()
  const { analysisContext } = useAnalysisContext()

  return (
    <SplitLayout
      left={
        <LeftPanel>
          <KakaoMap
            options={mapOptions}
            userLocation={analysisContext.userLocation}
          />
          <MetricCards />
        </LeftPanel>
      }
      right={<AgentPanel />}
    />
  )
}
