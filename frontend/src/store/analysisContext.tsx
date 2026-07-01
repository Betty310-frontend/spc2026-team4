'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { reverseGeocode } from '@/lib/geocode'
import type { AnalysisContext, ConfirmedPosition } from '@/types/analysis'

const defaultContext: AnalysisContext = {
  industry: null,
  location: null,
  radius: null,
  userLocation: null,
  confirmedPosition: null,
  center: null,
  dongCode: null,
  fullLocationName: null,
}

interface AnalysisContextValue {
  analysisContext: AnalysisContext
  confirmPosition: (lat: number, lng: number) => Promise<ConfirmedPosition | null>
  getConfirmedPosition: () => ConfirmedPosition | null
  // TODO: 에이전트 onFinish 콜백에서 파싱 결과를 setAnalysisContext로 주입
  // 예: setAnalysisContext({ industry: '카페', location: '연남동', radius: 500 })
  // TODO: 조건 변경(반경·업종 수정) 시 setAnalysisContext로 부분 업데이트
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void
}

const AnalysisCtx = createContext<AnalysisContextValue | null>(null)

type AnalysisContextActions = {
  confirmPosition: (lat: number, lng: number) => Promise<ConfirmedPosition | null>
  getConfirmedPosition: () => ConfirmedPosition | null
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void
}

let analysisContextActions: AnalysisContextActions | null = null

export function applyAnalysisContext(partial: Partial<AnalysisContext>): void {
  analysisContextActions?.setAnalysisContext(partial)
}

export function AnalysisContextProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<AnalysisContext>(defaultContext)
  const confirmSeqRef = useRef(0)
  const confirmedPositionRef = useRef<ConfirmedPosition | null>(null)

  const value = useMemo<AnalysisContextValue>(
    () => ({
      analysisContext: ctx,
      getConfirmedPosition: () => confirmedPositionRef.current,
      confirmPosition: async (lat, lng) => {
        const sequence = ++confirmSeqRef.current

        const regionResult = await reverseGeocode(lat, lng)
        if (!regionResult) return null

        // 최신 요청만 반영한다. 오래된 역지오코딩 결과가 ref/state를 덮지 못하게 막는다.
        if (sequence !== confirmSeqRef.current) return null

        const confirmedPosition: ConfirmedPosition = {
          lat,
          lng,
          dongName: regionResult.dongName,
          dongCode: regionResult.dongCode,
        }
        confirmedPositionRef.current = confirmedPosition

        setCtx((prev) => {
          return {
            ...prev,
            confirmedPosition,
            location: regionResult.dongName,
            dongCode: regionResult.dongCode,
            fullLocationName: regionResult.fullName,
            center: null,
          }
        })

        return confirmedPosition
      },
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
