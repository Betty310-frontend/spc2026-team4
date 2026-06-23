export interface Competitor {
  bizesId: string
  bizesNm: string
  rdnmAdr: string
  lat: number
  lng: number
  type: 'same' | 'similar'
}

export interface CompetitorsResponse {
  total: number
  same_type: number
  similar_type: number
  data_source: string
  base_date: string
  center: { lat: number; lng: number }
  radius_m: number
  fallback: boolean
  tier: 'high' | 'mid' | 'low'
  percentile: number
  data: Competitor[]
}

export interface PopulationResponse {
  dong_code: string
  dong_name: string
  base_date: string
  data_source: string
  weighted_avg: number
  percentile: number
  time_range: string
  fallback: boolean
}

export interface CompetitionPercentileResponse {
  percentile: number
  tier: 'high' | 'mid' | 'low'
  label: string
  same_business_count: number
  weighted_population: number
  data_source: string
  base_date: string
  fallback: boolean
  fallback_reason: string | null
}
