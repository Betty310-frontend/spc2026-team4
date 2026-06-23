import { MetricCard, ReportData } from '@/store/analysisResult'

type MetricKey = 'competitors' | 'density' | 'population'

export function handleToolResult(
  toolName: string,
  result: unknown,
  updateMetric: (key: MetricKey, data: Partial<MetricCard>) => void,
  setReportData: (report: ReportData) => void,
) {
  if (!result) return
  const r = result as Record<string, unknown>

  switch (toolName) {
    case 'search_competitors':
      updateMetric('competitors', {
        status: 'done',
        value: `${r.count}곳`,
        badge: `서울 상위 ${100 - (r.percentile as number)}%`,
        badgeTier: r.tier as 'high' | 'mid' | 'low',
        source: `${r.source} · ${r.date}`,
        isFallback: r.fallback as boolean | undefined,
      })
      break

    case 'get_population_flow':
      updateMetric('population', {
        status: 'done',
        value: `${r.percentile}P`,
        badge: `서울 상위 ${100 - (r.percentile as number)}%`,
        badgeTier: r.tier as 'high' | 'mid' | 'low',
        source: `${r.source} · ${r.timeRange}`,
      })
      break

    case 'calc_competition_percentile':
      updateMetric('density', {
        status: 'done',
        value: `${r.percentile}P`,
        badge: percentileToBadge(r.percentile as number),
        badgeTier: r.tier as 'high' | 'mid' | 'low',
        source: `H3 퍼센타일 · ${r.date}`,
      })
      break

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

function percentileToBadge(p: number): string {
  if (p >= 80) return '매우 높음'
  if (p >= 60) return '높음'
  if (p >= 40) return '보통'
  return '낮음'
}
