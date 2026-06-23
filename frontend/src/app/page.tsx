'use client'

import dynamic from 'next/dynamic'
import { SplitLayout, LeftPanel } from '@/components/layout'
import { MetricCards } from '@/components/metrics/MetricCards'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useMockAnalysis } from '@/hooks/use-mock-analysis' // [DEV ONLY]
import { useAnalysisContext } from '@/store/analysisContext'

// Kakao Maps SDK는 브라우저 전용. SSR에서 제외해 hydration 타이밍 충돌 방지.
const KakaoMap = dynamic(
  () => import('@/components/map/KakaoMap').then((m) => ({ default: m.KakaoMap })),
  { ssr: false },
)

export default function Home() {
  // [DEV ONLY] 서버 개발 완료 후 useMockAnalysis 제거
  // mapOptions는 추후 useAgentChat의 tool result에서 주입
  const { runMockAnalysis, mapOptions, isLoading } = useMockAnalysis()
  const { analysisContext } = useAnalysisContext()

  return (
    <>
      <SplitLayout
        left={
          <LeftPanel>
            <KakaoMap
              options={mapOptions}
              userLocation={analysisContext.userLocation}
              isLoading={isLoading}
            />
            <MetricCards />
          </LeftPanel>
        }
        right={<AgentPanel />}
      />

      {/* [DEV ONLY] 서버 개발 완료 후 아래 블록 전체 제거 */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={runMockAnalysis}
          className="border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground fixed bottom-4 left-4 z-50 rounded border px-2 py-1 text-[10px]"
        >
          [DEV] 목업 분석 실행
        </button>
      )}
    </>
  )
}
