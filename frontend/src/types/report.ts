export interface ReportDataSource {
  label: string
  provider: string
  reference: string
  url: string
}

export interface ReportMeta {
  station: string
  category: string
  radius_m: number
  dong_name: string | null
  generated_at: string
  data_sources: ReportDataSource[]
}

export interface ReportCompetition {
  competitor_count: number
  competition_percentile: number
  percentile_label: string
  tier: 'high' | 'mid' | 'low'
}

export interface ReportSales {
  per_store_est_amt: number | null
  per_store_est_amt_label: string | null
  per_store_est_cnt: number | null
  weekday_avg_amt: number | null
  weekend_avg_amt: number | null
  weekday_weekend_ratio: string | null
  by_timeslot: Array<{ label: string; value: number }>
  peak_slot: string | null
  by_age: Array<{ label: string; value: number }>
  top_age: string | null
  male_amt: number | null
  female_amt: number | null
  gender_ratio: string | null
}

export interface ReportPopulation {
  avg_peak_population: number | null
  peak_hour: string | null
  male_ratio: number | null
  female_ratio: number | null
  by_age_ratio: Array<{ label: string; value: number }>
  top_age: string | null
  hourly: Array<{ hour: string; count: number }>
}

export interface ReportCharts {
  population_hourly?: Array<{ label: string; value: number }>
  sales_by_timeslot?: Array<{ label: string; value: number }>
  sales_by_age?: Array<{ label: string; value: number }>
  population_by_age?: Array<{ label: string; value: number }>
  gender_sales?: Array<{ label: string; value: number }>
  gender_sales_ratio?: Array<{ label: string; value: number }>
  weekday_weekend_sales?: Array<{ label: string; value: number }>
  competition_gauge?: {
    percentile: number
    label: string
    tier: 'high' | 'mid' | 'low'
    competitor_count: number
  }
  per_store_summary?: {
    monthly_amt: number
    monthly_amt_label: string | null
    monthly_cnt: number | null
  }
}

export interface ReportResponse {
  meta: ReportMeta
  competition: ReportCompetition
  sales: ReportSales
  population: ReportPopulation
  swot: {
    강점: string[]
    약점: string[]
    기회: string[]
    위협: string[]
  }
  insights: string[]
  strategy: string[]
  checklist_questions: string[]
  risk_summary: string
  forbidden_violated: boolean
  charts: ReportCharts
}

