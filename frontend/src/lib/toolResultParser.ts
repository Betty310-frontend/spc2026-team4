import { MetricCard, ReportData } from '@/store/analysisResult'
import {
  applyCompetitors,
  normalizeCompetitors,
  type CompetitorsApiResponse,
} from '@/lib/agent-event-bridge'
import { getTierBadgeLabel } from '@/lib/metric-badge'
import type {
  CalcCompetitionPercentileToolResponse,
  GetPopulationFlowToolResponse,
  SearchCompetitorsToolResponse,
  PopulationResponse,
  CompetitionPercentileResponse,
} from '@/types/api'

type MetricKey = 'competitors' | 'density' | 'population'

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ko-KR').format(value)
}

function setSearchCompetitorMetrics(
  result: SearchCompetitorsToolResponse,
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void,
) {
  const metrics = result.metrics
  const competitorCount = metrics.competitor_count
  const competitionPercentile = metrics.competition_percentile
  const population = metrics.avg_peak_population
  const competitionBadge = getTierBadgeLabel(competitionPercentile) ?? '서울 하위권'
  const source = `소상공인시장진흥공단 · ${metrics.data_reference_month}`

  updateMetric('competitors', {
    status: 'done',
    value: formatNumber(competitorCount),
    unit: '곳',
    badge: competitionBadge,
    badgeTier: competitionPercentile >= 70 ? 'high' : competitionPercentile >= 40 ? 'mid' : 'low',
    source,
  })

  updateMetric('density', {
    status: 'done',
    value: formatNumber(competitionPercentile),
    unit: 'P',
    badge: competitionBadge,
    badgeTier: competitionPercentile >= 70 ? 'high' : competitionPercentile >= 40 ? 'mid' : 'low',
    source,
  })

  if (population != null) {
    updateMetric('population', {
      status: 'done',
      value: formatNumber(population),
      unit: '명',
      badge: metrics.top_population_age ?? undefined,
      badgeTier: 'info',
    })
  } else {
    updateMetric('population', {
      status: 'fallback',
      value: '—',
      unit: '명',
      isFallback: true,
    })
  }
}

export function handleToolResult(
  toolName: string,
  result: unknown,
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void,
  setReportData: (report: ReportData) => void,
) {
  if (!result) return

  switch (toolName) {
    case 'search_competitors': {
      const payload = result as SearchCompetitorsToolResponse | CompetitorsApiResponse

      if ('metrics' in payload && 'top_competitors' in payload) {
        setSearchCompetitorMetrics(payload as SearchCompetitorsToolResponse, updateMetric)
        break
      }

      applyCompetitors(normalizeCompetitors(payload as CompetitorsApiResponse))
      break
    }

    case 'get_population_flow': {
      const r = result as GetPopulationFlowToolResponse | PopulationResponse
      const avgPeakPopulation =
        'avg_peak_population' in r ? r.avg_peak_population : r.weighted_avg
      const populationPercentile = 'percentile' in r ? r.percentile : null
      updateMetric('population', {
        status: avgPeakPopulation == null ? 'fallback' : 'done',
        value: formatNumber(avgPeakPopulation),
        unit: '명',
        badge:
          'data_source' in r && 'base_date' in r
            ? `${r.data_source} · ${r.base_date}`
            : populationPercentile != null
              ? `서울 상위 ${100 - populationPercentile}%`
              : undefined,
        badgeTier:
          populationPercentile == null
            ? undefined
            : populationPercentile >= 70
              ? 'high'
              : populationPercentile >= 40
                ? 'mid'
                : 'low',
        source:
          'data_source' in r && 'base_date' in r ? `${r.data_source} · ${r.base_date}` : undefined,
        isFallback: avgPeakPopulation == null || ('fallback' in r && r.fallback),
      })
      break
    }

    case 'calc_competition_percentile': {
      const r = result as CalcCompetitionPercentileToolResponse | CompetitionPercentileResponse
      const percentile = 'competition_percentile' in r ? r.competition_percentile : r.percentile
      const label = 'percentile_label' in r ? r.percentile_label : r.label
      updateMetric('density', {
        status: 'done',
        value: `${formatNumber(percentile)}`,
        unit: 'P',
        badge: label,
        badgeTier:
          'tier' in r
            ? (r.tier as 'high' | 'mid' | 'low')
            : percentile >= 70
              ? 'high'
              : percentile >= 40
                ? 'mid'
                : 'low',
        source:
          'data_source' in r && 'base_date' in r ? `${r.data_source} · ${r.base_date}` : undefined,
        isFallback: 'fallback' in r ? r.fallback : undefined,
      })
      break
    }

    case 'get_positioning_data':
      break

    default:
      void setReportData
      break
  }
}
