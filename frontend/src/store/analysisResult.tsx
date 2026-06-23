'use client'

import { createContext, useContext, useReducer } from 'react'

export type MetricStatus = 'idle' | 'loading' | 'done' | 'error' | 'fallback'

export interface MetricCard {
  status: MetricStatus
  value?: string
  badge?: string
  badgeTier?: 'high' | 'mid' | 'low'
  source?: string
  isFallback?: boolean
}

export interface ReportData {
  요약: string
  긍정_요인: string[]
  위험_요인: string[]
  전략_제안: string[]
  swot: {
    강점: string[]
    약점: string[]
    기회: string[]
    위협: string[]
  }
}

export interface AnalysisResult {
  competitors: MetricCard
  density: MetricCard
  population: MetricCard
  report: ReportData | null
}

type MetricKey = 'competitors' | 'density' | 'population'

type Action =
  | { type: 'UPDATE_METRIC'; key: MetricKey; data: Partial<MetricCard> }
  | { type: 'SET_REPORT'; report: ReportData }
  | { type: 'RESET' }

const defaultResult: AnalysisResult = {
  competitors: { status: 'idle' },
  density: { status: 'idle' },
  population: { status: 'idle' },
  report: null,
}

function reducer(state: AnalysisResult, action: Action): AnalysisResult {
  switch (action.type) {
    case 'UPDATE_METRIC':
      return { ...state, [action.key]: { ...state[action.key], ...action.data } }
    case 'SET_REPORT':
      return { ...state, report: action.report }
    case 'RESET':
      return defaultResult
    default:
      return state
  }
}

interface AnalysisResultContextValue extends AnalysisResult {
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void
  setReportData: (report: ReportData) => void
  reset: () => void
}

const AnalysisResultCtx = createContext<AnalysisResultContextValue | null>(null)

export function AnalysisResultProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultResult)

  const value: AnalysisResultContextValue = {
    ...state,
    updateMetric: (key, data) => dispatch({ type: 'UPDATE_METRIC', key, data }),
    setReportData: (report) => dispatch({ type: 'SET_REPORT', report }),
    reset: () => dispatch({ type: 'RESET' }),
  }

  return <AnalysisResultCtx.Provider value={value}>{children}</AnalysisResultCtx.Provider>
}

// 추후 Zustand 교체 시 이 훅 시그니처만 유지하면 사용처 변경 불필요
export function useAnalysisResult() {
  const ctx = useContext(AnalysisResultCtx)
  if (!ctx) throw new Error('useAnalysisResult must be used within AnalysisResultProvider')
  return ctx
}
