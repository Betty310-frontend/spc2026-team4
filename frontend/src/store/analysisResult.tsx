'use client'

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { MapOptions } from '@/types/api'
import type { NormalizedCompetitors } from '@/lib/agent-event-bridge'

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
  mapOptions: MapOptions | null
  mapSync: MapSync
  chatLoading: boolean
}

export interface MapSync {
  token: number
  pending: boolean
  reason?: string
  startedAt?: number
}

type MetricKey = 'competitors' | 'density' | 'population'

type Action =
  | { type: 'UPDATE_METRIC'; key: MetricKey; data: Partial<MetricCard> }
  | { type: 'SET_REPORT'; report: ReportData }
  | { type: 'SET_MAP_OPTIONS'; mapOptions: MapOptions | null }
  | { type: 'SET_CHAT_LOADING'; loading: boolean }
  | { type: 'BEGIN_MAP_UPDATE'; reason?: string }
  | { type: 'COMPLETE_MAP_UPDATE'; token: number }
  | { type: 'ABORT_MAP_UPDATE'; token?: number }
  | { type: 'RESET' }

const defaultResult: AnalysisResult = {
  competitors: { status: 'idle' },
  density: { status: 'idle' },
  population: { status: 'idle' },
  report: null,
  mapOptions: null,
  mapSync: { token: 0, pending: false },
  chatLoading: false,
}

function reducer(state: AnalysisResult, action: Action): AnalysisResult {
  switch (action.type) {
    case 'UPDATE_METRIC':
      return { ...state, [action.key]: { ...state[action.key], ...action.data } }
    case 'SET_REPORT':
      return { ...state, report: action.report }
    case 'SET_MAP_OPTIONS':
      return { ...state, mapOptions: action.mapOptions }
    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.loading }
    case 'BEGIN_MAP_UPDATE':
      return {
        ...state,
        mapSync: {
          token: state.mapSync.token + 1,
          pending: true,
          reason: action.reason,
          startedAt: Date.now(),
        },
      }
    case 'COMPLETE_MAP_UPDATE':
      return action.token === state.mapSync.token
        ? { ...state, mapSync: { ...state.mapSync, pending: false } }
        : state
    case 'ABORT_MAP_UPDATE':
      return !action.token || action.token === state.mapSync.token
        ? { ...state, mapSync: { ...state.mapSync, pending: false } }
        : state
    case 'RESET':
      return defaultResult
    default:
      return state
  }
}

interface AnalysisResultContextValue extends AnalysisResult {
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void
  setReportData: (report: ReportData) => void
  setMapOptions: (mapOptions: MapOptions | null) => void
  setChatLoading: (loading: boolean) => void
  beginMapUpdate: (reason?: string) => void
  completeMapUpdate: (token: number) => void
  abortMapUpdate: (token?: number) => void
  getCurrentMapToken: () => number
  applyCompetitorsFromRest: (payload: NormalizedCompetitors) => void
  reset: () => void
}

const AnalysisResultCtx = createContext<AnalysisResultContextValue | null>(null)

type AnalysisResultActions = {
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void
  setReportData: (report: ReportData) => void
  setMapOptions: (mapOptions: MapOptions | null) => void
  setChatLoading: (loading: boolean) => void
  beginMapUpdate: (reason?: string) => void
  completeMapUpdate: (token: number) => void
  abortMapUpdate: (token?: number) => void
  getCurrentMapToken: () => number
  applyCompetitorsFromRest: (payload: NormalizedCompetitors) => void
  reset: () => void
}

let analysisResultActions: AnalysisResultActions | null = null

export function applyCompetitorsFromRest(payload: NormalizedCompetitors): void {
  analysisResultActions?.applyCompetitorsFromRest(payload)
}

export function beginMapUpdate(reason?: string): void {
  analysisResultActions?.beginMapUpdate(reason)
}

export function setChatLoading(loading: boolean): void {
  analysisResultActions?.setChatLoading(loading)
}

export function completeMapUpdate(token: number): void {
  analysisResultActions?.completeMapUpdate(token)
}

export function abortMapUpdate(token?: number): void {
  analysisResultActions?.abortMapUpdate(token)
}

export function getCurrentMapToken(): number {
  return analysisResultActions?.getCurrentMapToken() ?? 0
}

export function AnalysisResultProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultResult)

  const value = useMemo<AnalysisResultContextValue>(() => {
    const applyCompetitors = (payload: NormalizedCompetitors) => {
      const status = payload.fallback ? 'fallback' : 'done'
      const source =
        payload.source && payload.asOf
          ? `${payload.source} · ${payload.asOf}`
          : payload.source ?? payload.asOf

      dispatch({
        type: 'UPDATE_METRIC',
        key: 'competitors',
        data: {
          status,
          value: `${payload.sameCount}곳`,
          badge: `총 ${payload.total ?? payload.items.length}곳`,
          source,
          isFallback: payload.fallback,
        },
      })

      if (payload.center) {
        dispatch({
          type: 'SET_MAP_OPTIONS',
          mapOptions: {
            center: payload.center,
            radius_m: payload.radiusM ?? 500,
            competitors: payload.items,
          },
        })
      }
    }

    return {
      ...state,
      updateMetric: (key, data) => dispatch({ type: 'UPDATE_METRIC', key, data }),
      setReportData: (report) => dispatch({ type: 'SET_REPORT', report }),
      setMapOptions: (mapOptions) => dispatch({ type: 'SET_MAP_OPTIONS', mapOptions }),
      setChatLoading: (loading) => dispatch({ type: 'SET_CHAT_LOADING', loading }),
      beginMapUpdate: (reason) => dispatch({ type: 'BEGIN_MAP_UPDATE', reason }),
      completeMapUpdate: (token) => dispatch({ type: 'COMPLETE_MAP_UPDATE', token }),
      abortMapUpdate: (token) => dispatch({ type: 'ABORT_MAP_UPDATE', token }),
      getCurrentMapToken: () => state.mapSync.token,
      applyCompetitorsFromRest: applyCompetitors,
      reset: () => dispatch({ type: 'RESET' }),
    }
  }, [state])

  useEffect(() => {
    analysisResultActions = value
    return () => {
      if (analysisResultActions === value) analysisResultActions = null
    }
  }, [value])

  return <AnalysisResultCtx.Provider value={value}>{children}</AnalysisResultCtx.Provider>
}

// 추후 Zustand 교체 시 이 훅 시그니처만 유지하면 사용처 변경 불필요
export function useAnalysisResult() {
  const ctx = useContext(AnalysisResultCtx)
  if (!ctx) throw new Error('useAnalysisResult must be used within AnalysisResultProvider')
  return ctx
}
