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

// ── chat tool outputs ─────────────────────────

export interface MarketAnalysisMetrics {
  competitor_count: number
  competition_percentile: number
  monthly_avg_sales_amt: number | null
  monthly_avg_sales_cnt: number | null
  per_store_est_amt: number | null
  per_store_est_cnt: number | null
  weekday_avg_amt: number | null
  weekend_avg_amt: number | null
  male_avg_amt: number | null
  female_avg_amt: number | null
  sales_by_timeslot: unknown
  peak_sales_slot: string | null
  sales_by_age: unknown
  top_sales_age: string | null
  avg_peak_population: number | null
  peak_population_hour: string | null
  hourly_population: unknown
  male_pop_ratio: number | null
  female_pop_ratio: number | null
  population_by_age_ratio: unknown
  top_population_age: string | null
  data_reference_month: string
}

export interface SearchCompetitorsToolTopCompetitor {
  analysis_name: string
  display_name: string
  category: string
}

export interface SearchCompetitorsToolResponse {
  summary: string
  station: string
  category: string
  radius_m: number
  dong_name: string | null
  top_competitors: SearchCompetitorsToolTopCompetitor[]
  metrics: MarketAnalysisMetrics
  summarize: Record<string, unknown>
}

export interface GetPopulationFlowToolResponse {
  station: string
  dong_name: string | null
  avg_peak_population: number | null
  peak_hours_label: string | null
  peak_population_hour: string | null
  hourly_population: unknown
  male_pop_ratio: number | null
  female_pop_ratio: number | null
  population_by_age_ratio: unknown
  top_population_age: string | null
  data_source: string
  base_date: string
}

export interface CalcCompetitionPercentileToolResponse {
  station: string
  category: string
  radius_m: number
  dong_name: string | null
  competitor_count: number
  competition_percentile: number
  percentile_label: string
}

// ── /api/v1/h3-hexagons ───────────────────────

export interface H3HexagonItem {
  h3Index: string
  count: number
}

export interface CompetitionSurfaceItem {
  h3: string
  p: number
}

// ── map 관련 ──────────────────────────────────

export interface MapOptions {
  center: CenterCoords
  radius_m: number
  competitors: CompetitorItem[]
}
