import { withRetry, ApiError } from '@/lib/retry'
import type {
  CompetitorsResponse,
  PopulationResponse,
  CompetitionPercentileResponse,
  RentResponse,
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
  return apiFetch(`/api/v1/competitors?${query}`)
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
  return apiFetch(`/api/v1/population?${query}`)
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
  return apiFetch(`/api/v1/competition-percentile?${query}`)
}

export async function fetchRent(params: {
  행정동코드: string
  업종: string
  면적_sqm?: number
}): Promise<RentResponse> {
  const query = new URLSearchParams()
  query.set('행정동코드', params.행정동코드)
  query.set('업종', params.업종)
  if (params.면적_sqm != null) query.set('면적_sqm', String(params.면적_sqm))
  return apiFetch(`/api/v1/rent?${query}`)
}

export async function fetchH3Hexagons(params: {
  station: string
  category: string
  radius?: number
  resolution?: number
}): Promise<H3HexagonItem[]> {
  const query = new URLSearchParams()
  query.set('station',  params.station)
  query.set('category', params.category)
  if (params.radius     != null) query.set('radius',     String(params.radius))
  if (params.resolution != null) query.set('resolution', String(params.resolution))
  return apiFetch(`/api/v1/h3-hexagons?${query}`)
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/health')
    return res.ok
  } catch {
    return false
  }
}
