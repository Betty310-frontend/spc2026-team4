'use client'

import { useAnalysisContext } from '@/store/analysisContext'
import { CHIP_COLORS } from '@/styles/colors'
import ContextChip from './ContextChip'

const INDUSTRY_EMOJI: Record<string, string> = {
  카페: '☕',
  학원: '📚',
  미용실: '✂️',
  음식점: '🍽️',
}

export default function Topbar() {
  const { analysisContext } = useAnalysisContext()
  const { industry, location, radius } = analysisContext
  const hasContext = industry !== null || location !== null

  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-[6px] border-b border-black/[0.11] bg-white px-3">
      {/* 로고 */}
      <div className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-black/20" />
      <span className="text-[11px] font-medium text-gray-900">상권 AI 진단</span>

      {/* 컨텍스트 칩 — industry 또는 location이 설정된 경우만 노출 */}
      {hasContext && (
        <div className="ml-4 flex items-center gap-2">
          {industry && (
            <ContextChip
              label={`${INDUSTRY_EMOJI[industry] ?? '🏪'} ${industry}`}
              dotColor={CHIP_COLORS['업종'].dot}
            />
          )}
          {location && <ContextChip label={`📍 ${location}`} dotColor={CHIP_COLORS['위치'].dot} />}
          {radius !== null && <ContextChip label={`반경 ${radius}m`} />}
        </div>
      )}
    </header>
  )
}
