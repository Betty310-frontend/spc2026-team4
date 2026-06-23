'use client'

import { Loader2 } from 'lucide-react'
import { useAnalysisResult } from '@/store/analysisResult'

export function MapPlaceholder() {
  const { competitors } = useAnalysisResult()
  const isLoading = competitors.status === 'loading'

  return (
    <div className="bg-muted relative flex flex-1 flex-col items-center justify-center rounded-lg">
      {!isLoading && (
        <>
          <span className="mb-2 text-3xl">📍</span>
          <p className="text-muted-foreground text-center text-xs">
            에이전트에게 창업 업종과 위치를 말해주세요
          </p>
        </>
      )}
      {isLoading && (
        <div className="bg-background/60 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg backdrop-blur-[1px]">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          <span className="text-muted-foreground text-xs">데이터 수집 중…</span>
        </div>
      )}
    </div>
  )
}
