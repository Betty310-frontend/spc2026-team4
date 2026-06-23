'use client'

import { SplitLayout, LeftPanel } from '@/components/layout'
import { KakaoMap } from '@/components/map/KakaoMap'
import { MetricCards } from '@/components/metrics/MetricCards'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useMockAnalysis } from '@/hooks/use-mock-analysis' // [DEV ONLY]

export default function Home() {
  // [DEV ONLY] 서버 개발 완료 후 useMockAnalysis 제거
  // mapOptions는 추후 useAgentChat의 tool result에서 주입
  const { runMockAnalysis, mapOptions, isLoading } = useMockAnalysis()

  return (
    <>
      <SplitLayout
        left={
          <LeftPanel>
            <KakaoMap options={mapOptions} isLoading={isLoading} />
            <MetricCards />
          </LeftPanel>
        }
        right={<AgentPanel />}
      />

      {/* [DEV ONLY] 서버 개발 완료 후 아래 블록 전체 제거 */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={runMockAnalysis}
          className="fixed bottom-4 left-4 z-50 rounded border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          [DEV] 목업 분석 실행
        </button>
      )}
    </>
  )
}
