'use client'

import { SplitLayout, LeftPanel } from '@/components/layout'
import { MetricCards } from '@/components/metrics/MetricCards'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useAnalysisResult } from '@/store/analysisResult'
import { useAnalysisContext } from '@/store/analysisContext'
import { KakaoMap } from '@/components/map/KakaoMap'

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
