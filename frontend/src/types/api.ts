// ── 공통 ──────────────────────────────────────

export interface CenterCoords {
  lat: number
  lng: number
}

// ── /api/v1/competitors ───────────────────────

export interface CompetitorItem {
  id: string
  name: string
  lat: number
  lng: number
  type: 'same' | 'similar'
  category: string | null // 업종명 (아이콘 매핑에 사용)
  address: string | null
}

export interface CompetitorsResponse {
  total: number
  same_type: number
  similar_type: number
  data_source: string
  base_date: string
  center: CenterCoords
  radius_m: number
  fallback: boolean
  fallback_reason: string | null
  data: CompetitorItem[]
}

// ── /api/v1/population ────────────────────────

export interface PopulationHourItem {
  hour: string
  count: number
}

export interface PopulationResponse {
  dong_code: string
  dong_name: string | null
  base_date: string
  data_source: string
  weighted_avg: number | null
  percentile: number | null
  time_weights_applied: string[]
  fallback: boolean
  fallback_reason: string | null
  data: PopulationHourItem[]
}

// ── /api/v1/competition-percentile ────────────

export interface CompetitionPercentileResponse {
  percentile: number
  tier: string // "high" | "mid" | "low"
  label: string // 예: "서울 상위 18%"
  h3_resolution: number
  competitor_density: number
  population_normalized: boolean
  data_source: string
  base_date: string
  fallback: boolean
}

// ── /api/v1/h3-hexagons ───────────────────────

export interface H3HexagonItem {
  h3Index: string
  count: number
}

// ── map 관련 ──────────────────────────────────

export interface MapOptions {
  center: CenterCoords
  radius_m: number
  competitors: CompetitorItem[]
}
