import { MetricCard, ReportData } from '@/store/analysisResult'
import {
  applyCompetitors,
  normalizeCompetitors,
  type CompetitorsApiResponse,
} from '@/lib/agent-event-bridge'
import { PopulationResponse, CompetitionPercentileResponse } from '@/types/api'

type MetricKey = 'competitors' | 'density' | 'population'

export function handleToolResult(
  toolName: string,
  result: unknown,
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void,
  setReportData: (report: ReportData) => void,
) {
  if (!result) return

  switch (toolName) {
    case 'search_competitors': {
      applyCompetitors(normalizeCompetitors(result as CompetitorsApiResponse))
      break
    }

    case 'get_population_flow': {
      const r = result as PopulationResponse
      const p = r.percentile ?? 0
      updateMetric('population', {
        status: 'done',
        value: `${p}P`,
        badge: `서울 상위 ${100 - p}%`,
        badgeTier: p >= 70 ? 'high' : p >= 40 ? 'mid' : 'low',
        source: `${r.data_source} · ${r.base_date}`,
        isFallback: r.fallback,
      })
      break
    }

    case 'calc_competition_percentile': {
      const r = result as CompetitionPercentileResponse
      updateMetric('density', {
        status: 'done',
        value: `${r.percentile}P`,
        badge: r.label,
        badgeTier: r.tier as 'high' | 'mid' | 'low',
        source: `${r.data_source} · ${r.base_date}`,
        isFallback: r.fallback,
      })
      break
    }

    case 'get_rent_info':
    case 'get_positioning_data':
      break

    default:
      void setReportData
      break
  }
}
