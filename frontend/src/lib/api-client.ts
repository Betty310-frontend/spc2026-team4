import { withRetry, ApiError } from '@/lib/retry'
import { startLoading, stopLoading, type LoadingKey } from '@/store/analysisResult'
import { isValidCategory } from '@/lib/category'
import type {
  CompetitorsResponse,
  PopulationResponse,
  CompetitionPercentileResponse,
  H3HexagonItem,
} from '@/types/api'

// 공통 fetch 래퍼 — ApiError throw + 자동 재시도 포함
async function apiFetch<T>(url: string): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(url)
    if (!res.ok) {
      throw new ApiError(res.status, `API 오류: ${res.status}`)
    }
    return res.json() as Promise<T>
  })
}

async function withLoading<T>(key: LoadingKey, task: () => Promise<T>): Promise<T> {
  startLoading(key)
  try {
    return await task()
  } finally {
    stopLoading(key)
  }
}

export async function fetchCompetitors(params: {
  위치: string
  업종: string
  반경?: number
  lat?: number
  lng?: number
}): Promise<CompetitorsResponse> {
  const query = new URLSearchParams()
  query.set('위치', params.위치)
  query.set('업종', params.업종)
  if (params.반경 != null) query.set('반경', String(params.반경))
  if (params.lat   != null) query.set('lat',   String(params.lat))
  if (params.lng   != null) query.set('lng',   String(params.lng))
  return withLoading('competitors', () => apiFetch(`/api/v1/competitors?${query}`))
}

export async function fetchPopulation(params: {
  행정동코드: string
  업종: string
  시간대?: string[]
}): Promise<PopulationResponse> {
  const query = new URLSearchParams()
  query.set('행정동코드', params.행정동코드)
  query.set('업종', params.업종)
  params.시간대?.forEach((t) => query.append('시간대', t))
  return withLoading('population', () => apiFetch(`/api/v1/population?${query}`))
}

export async function fetchCompetitionPercentile(params: {
  lat: number
  lng: number
  업종: string
  반경?: number
}): Promise<CompetitionPercentileResponse> {
  const query = new URLSearchParams()
  query.set('lat',  String(params.lat))
  query.set('lng',  String(params.lng))
  query.set('업종', params.업종)
  if (params.반경 != null) query.set('반경', String(params.반경))
  return withLoading('competition-percentile', () =>
    apiFetch(`/api/v1/competition-percentile?${query}`),
  )
}

export async function fetchH3Hexagons(params: {
  station: string
  category: string
  radius?: number
  resolution?: number
}): Promise<H3HexagonItem[]> {
  if (!isValidCategory(params.category)) return []
  const query = new URLSearchParams()
  query.set('station',  params.station)
  query.set('category', params.category)
  if (params.radius     != null) query.set('radius',     String(params.radius))
  if (params.resolution != null) query.set('resolution', String(params.resolution))
  return withLoading('h3-hexagons', () => apiFetch(`/api/v1/h3-hexagons?${query}`))
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/health')
    return res.ok
  } catch {
    return false
  }
}
