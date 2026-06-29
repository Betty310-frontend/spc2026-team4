import { INDIGO } from '@/styles/colors'

export function getTierBadgeLabel(percentile: number | null | undefined): string | null {
  if (percentile == null || !Number.isFinite(percentile)) return null

  if (percentile >= 70) {
    return `서울 상위 ${100 - percentile}%`
  }

  if (percentile >= 40) {
    return '서울 중위권'
  }

  return '서울 하위권'
}

export type MetricBadgeTier = 'high' | 'mid' | 'low' | 'info'
export type MetricBadgeDirection = 'positive' | 'negative'
const BADGE_DIRECTION_COLORS: Record<
  MetricBadgeDirection,
  Record<Exclude<MetricBadgeTier, 'info'>, { bg: string; text: string }>
> = {
  negative: {
    high: { bg: '#F09595', text: '#501313' },
    mid: { bg: '#EF9F27', text: '#412402' },
    low: { bg: '#97C459', text: '#173404' },
  },
  positive: {
    high: { bg: '#97C459', text: '#173404' },
    mid: { bg: '#EF9F27', text: '#412402' },
    low: { bg: '#F09595', text: '#501313' },
  },
}

export function getMetricBadgeColor(
  direction: MetricBadgeDirection,
  tier: MetricBadgeTier | null | undefined,
): { bg: string; text: string } | null {
  if (!tier) return null
  if (tier === 'info') return { bg: INDIGO[50], text: INDIGO[800] }
  return BADGE_DIRECTION_COLORS[direction][tier]
}
