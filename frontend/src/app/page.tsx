'use client'

import { useState } from 'react'
import { SplitLayout, LeftPanel } from '@/components/layout'
import { MetricCards } from '@/components/metrics/MetricCards'
import { ReportSection } from '@/components/report/ReportSection'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { useAnalysisResult } from '@/store/analysisResult'
import { useAnalysisContext } from '@/store/analysisContext'
import { KakaoMap } from '@/components/map/KakaoMap'

export default function Home() {
  // mapOptions는 useAnalysis → setMapOptions → 스토어에서 공유
  const { mapOptions, isLoading } = useAnalysisResult()
  const { analysisContext } = useAnalysisContext()
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map')
  const [reportBadgeVisible, setReportBadgeVisible] = useState(false)

  return (
    <SplitLayout
      left={
        <LeftPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          reportBadgeVisible={reportBadgeVisible}
          mapTab={(isActive) => (
            <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
              <div className="min-h-0 flex-1">
                <KakaoMap
                  options={mapOptions}
                  userLocation={analysisContext.userLocation}
                  isLoading={isLoading}
                  isActive={isActive}
                />
              </div>
              <div className="shrink-0">
                <MetricCards />
              </div>
            </div>
          )}
          reportTab={(isActive) => (
            <div className="h-full min-h-0 flex-1 overflow-y-auto">
              <ReportSection isActive={isActive} />
            </div>
          )}
        />
      }
      right={
        <AgentPanel
          onOpenReportTab={() => {
            setActiveTab('report')
            setReportBadgeVisible(false)
          }}
          onReportAnnouncementVisibleChange={setReportBadgeVisible}
        />
      }
    />
  )
}
