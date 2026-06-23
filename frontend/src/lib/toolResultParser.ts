import { MetricCard, ReportData } from '@/store/analysisResult'
import {
  CompetitorsResponse,
  PopulationResponse,
  CompetitionPercentileResponse,
} from '@/types/api'

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
      const r = result as CompetitorsResponse
      updateMetric('competitors', {
        status: 'done',
        value: `${r.same_type}곳`,
        badge: `서울 상위 ${100 - r.percentile}%`,
        badgeTier: r.tier,
        source: `${r.data_source} · ${r.base_date}`,
        isFallback: r.fallback,
      })
      break
    }

    case 'get_population_flow': {
      const r = result as PopulationResponse
      updateMetric('population', {
        status: 'done',
        value: `${r.percentile}P`,
        badge: `서울 상위 ${100 - r.percentile}%`,
        badgeTier: r.percentile >= 70 ? 'high' : r.percentile >= 40 ? 'mid' : 'low',
        source: `${r.data_source} · ${r.time_range}`,
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
        badgeTier: r.tier,
        source: `${r.data_source} · ${r.base_date}`,
        isFallback: r.fallback,
      })
      break
    }

    case 'get_rent_info':
    case 'get_positioning_data':
      // TODO: 해당 데이터를 리포트 또는 별도 카드로 연결
      break

    default:
      // setReportData 연동은 에이전트 최종 응답 파싱 후 별도 처리
      void setReportData
      break
  }
}
