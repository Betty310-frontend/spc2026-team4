'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AnalysisContext } from '@/types/analysis'

const defaultContext: AnalysisContext = {
  industry: null,
  location: null,
  radius: null,
  userLocation: null,
  center: null,
  dongCode: null,
  fullLocationName: null,
}

interface AnalysisContextValue {
  analysisContext: AnalysisContext
  // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
  // 예: setAnalysisContext({ industry: '카페', location: '연남동', radius: 500 })
  // TODO: 조건 변경(반경·업종 수정) 시 setAnalysisContext로 부분 업데이트
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void
}

const AnalysisCtx = createContext<AnalysisContextValue | null>(null)

type AnalysisContextActions = {
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void
}

let analysisContextActions: AnalysisContextActions | null = null

export function applyAnalysisContext(partial: Partial<AnalysisContext>): void {
  analysisContextActions?.setAnalysisContext(partial)
}

export function AnalysisContextProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<AnalysisContext>(defaultContext)

  const value = useMemo<AnalysisContextValue>(
    () => ({
      analysisContext: ctx,
      // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
      // 예: setAnalysisContext({ industry: '카페', location: '연남동', radius: 500 })
      // TODO: 조건 변경(반경·업종 수정) 시 setAnalysisContext로 부분 업데이트
      setAnalysisContext: (partial) => {
        setCtx((prev) => ({ ...prev, ...partial }))
      },
    }),
    [ctx],
  )

  useEffect(() => {
    analysisContextActions = value
    return () => {
      if (analysisContextActions === value) analysisContextActions = null
    }
  }, [value])

  return <AnalysisCtx.Provider value={value}>{children}</AnalysisCtx.Provider>
}

// 추후 Zustand 교체 시 이 훅 시그니처만 유지하면 사용처 변경 불필요
export function useAnalysisContext() {
  const ctx = useContext(AnalysisCtx)
  if (!ctx) throw new Error('useAnalysisContext must be used within AnalysisContextProvider')
  return ctx
}
