'use client'

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { MapOptions } from '@/types/api'
import type { NormalizedCompetitors } from '@/lib/agent-event-bridge'
import type { ReportResponse } from '@/types/report'
import { formatNumber } from '@/lib/number-format'

export type MetricStatus = 'idle' | 'loading' | 'done' | 'error' | 'fallback'

export interface MetricCard {
  status: MetricStatus
  value?: string
  unit?: string
  badge?: string
  badgeTier?: 'high' | 'mid' | 'low' | 'info'
  source?: string
  isFallback?: boolean
  hint?: string
}

export type ReportData = ReportResponse

export interface AnalysisResult {
  competitors: MetricCard
  density: MetricCard
  population: MetricCard
  report: ReportData | null
  mapOptions: MapOptions | null
  mapSync: MapSync
  loadingKeys: Set<LoadingKey>
  isLoading: boolean
}

export interface MapSync {
  token: number
  pending: boolean
  reason?: string
  startedAt?: number
}

type MetricKey = 'competitors' | 'density' | 'population'
export type LoadingKey =
  | 'analysis'
  | 'chat'
  | 'competitors'
  | 'population'
  | 'competition-percentile'
  | 'h3-hexagons'

type Action =
  | { type: 'UPDATE_METRIC'; key: MetricKey; data: Partial<MetricCard> }
  | { type: 'SET_REPORT'; report: ReportData | null }
  | { type: 'SET_MAP_OPTIONS'; mapOptions: MapOptions | null }
  | { type: 'BEGIN_MAP_UPDATE'; reason?: string }
  | { type: 'COMPLETE_MAP_UPDATE'; token: number }
  | { type: 'ABORT_MAP_UPDATE'; token?: number }
  | { type: 'START_LOADING'; key: LoadingKey }
  | { type: 'STOP_LOADING'; key: LoadingKey }
  | { type: 'CLEAR_LOADING' }
  | { type: 'RESET' }

const defaultResult: AnalysisResult = {
  competitors: { status: 'idle' },
  density: { status: 'idle' },
  population: { status: 'idle' },
  report: null,
  mapOptions: null,
  mapSync: { token: 0, pending: false },
  loadingKeys: new Set<LoadingKey>(),
  isLoading: false,
}

function reducer(state: AnalysisResult, action: Action): AnalysisResult {
  switch (action.type) {
    case 'UPDATE_METRIC':
      return { ...state, [action.key]: { ...state[action.key], ...action.data } }
    case 'SET_REPORT':
      return { ...state, report: action.report }
    case 'SET_MAP_OPTIONS':
      return { ...state, mapOptions: action.mapOptions }
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
    case 'START_LOADING': {
      if (state.loadingKeys.has(action.key)) return state
      const loadingKeys = new Set(state.loadingKeys)
      loadingKeys.add(action.key)
      return { ...state, loadingKeys, isLoading: loadingKeys.size > 0 }
    }
    case 'STOP_LOADING': {
      if (!state.loadingKeys.has(action.key)) return state
      const loadingKeys = new Set(state.loadingKeys)
      loadingKeys.delete(action.key)
      return { ...state, loadingKeys, isLoading: loadingKeys.size > 0 }
    }
    case 'CLEAR_LOADING':
      return { ...state, loadingKeys: new Set<LoadingKey>(), isLoading: false }
    case 'RESET':
      return defaultResult
    default:
      return state
  }
}

interface AnalysisResultContextValue extends AnalysisResult {
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void
  setReportData: (report: ReportData | null) => void
  setMapOptions: (mapOptions: MapOptions | null) => void
  startLoading: (key: LoadingKey) => void
  stopLoading: (key: LoadingKey) => void
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
  setReportData: (report: ReportData | null) => void
  setMapOptions: (mapOptions: MapOptions | null) => void
  startLoading: (key: LoadingKey) => void
  stopLoading: (key: LoadingKey) => void
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

export function startLoading(key: LoadingKey): void {
  analysisResultActions?.startLoading(key)
}

export function stopLoading(key: LoadingKey): void {
  analysisResultActions?.stopLoading(key)
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
  const actions = useMemo(
    () => ({
      updateMetric: (key: MetricKey, data: Partial<MetricCard>) =>
        dispatch({ type: 'UPDATE_METRIC', key, data }),
      setReportData: (report: ReportData | null) => dispatch({ type: 'SET_REPORT', report }),
      setMapOptions: (mapOptions: MapOptions | null) =>
        dispatch({ type: 'SET_MAP_OPTIONS', mapOptions }),
      beginMapUpdate: (reason?: string) => dispatch({ type: 'BEGIN_MAP_UPDATE', reason }),
      completeMapUpdate: (token: number) => dispatch({ type: 'COMPLETE_MAP_UPDATE', token }),
      abortMapUpdate: (token?: number) => dispatch({ type: 'ABORT_MAP_UPDATE', token }),
      getCurrentMapToken: () => state.mapSync.token,
      applyCompetitorsFromRest: (payload: NormalizedCompetitors) => {
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
            value: `${formatNumber(payload.sameCount)}곳`,
            unit: '곳',
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
      },
      reset: () => dispatch({ type: 'RESET' }),
      startLoading: (key: LoadingKey) => dispatch({ type: 'START_LOADING', key }),
      stopLoading: (key: LoadingKey) => dispatch({ type: 'STOP_LOADING', key }),
    }),
    [state.mapSync.token],
  )

  const value = useMemo<AnalysisResultContextValue>(() => {
    return {
      ...state,
      ...actions,
    }
  }, [actions, state])

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
