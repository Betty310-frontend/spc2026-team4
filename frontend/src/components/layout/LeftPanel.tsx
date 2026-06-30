'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { TEXT_MUTED } from '@/styles/colors'
import { LeftPaneSpinner } from '@/components/LeftPaneSpinner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LeftPanelProps {
  mapTab: (isActive: boolean) => ReactNode
  reportTab: (isActive: boolean) => ReactNode
  activeTab: LeftTabKey
  onTabChange: (tab: LeftTabKey) => void
  reportBadgeVisible?: boolean
}

type LeftTabKey = 'map' | 'report'

export default function LeftPanel({
  mapTab,
  reportTab,
  activeTab,
  onTabChange,
  reportBadgeVisible = false,
}: LeftPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeTab])

  return (
    <div ref={scrollRef} className="relative flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-[10px]">
      <div className="sticky top-0 z-20 -mx-[10px] shrink-0 border-b border-black/[0.08] bg-white/95 px-[10px] pb-1 pt-0.5 backdrop-blur-sm">
        <div className="grid grid-cols-2 rounded-xl border border-black/[0.08] bg-muted/40 p-0.5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          <button
            type="button"
            onClick={() => onTabChange('map')}
            className={cn(
              'flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors',
              activeTab === 'map' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <span>🗺</span>
            <span>지도</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('report')}
            className={cn(
              'flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors',
              activeTab === 'report'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            <span>📊</span>
            <span>리포트</span>
            {reportBadgeVisible && (
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[9px] leading-none">
                ●
              </Badge>
            )}
          </button>
        </div>
      </div>

      <div className={activeTab === 'map' ? 'flex min-h-0 flex-1 flex-col gap-2' : 'hidden'}>
        {mapTab(activeTab === 'map')}
      </div>

      <div className={activeTab === 'report' ? 'flex min-h-0 flex-1 flex-col gap-2' : 'hidden'}>
        {reportTab(activeTab === 'report')}
      </div>

      <LeftPaneSpinner />
    </div>
  )
}

export function AnalysisDivider() {
  return (
    <div className="mt-1 border-t border-black/[0.11] pt-2">
      <p
        className="mb-1 text-[7.5px] font-semibold tracking-[0.06em] uppercase"
        style={{ color: TEXT_MUTED }}
      >
        경영 분석 — 스크롤로 확인
      </p>
    </div>
  )
}

export function ScrollHint() {
  return (
    <div
      className="flex items-center justify-center gap-1 border-t border-black/[0.11] py-1 text-[8px]"
      style={{ color: TEXT_MUTED }}
    >
      <span>↓</span>
      <span>경영 분석 영역 스크롤</span>
    </div>
  )
}
