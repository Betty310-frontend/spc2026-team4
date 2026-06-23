'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalysisResult, MetricCard } from '@/store/analysisResult'
import { BADGE_COLORS } from '@/styles/colors'

const METRIC_LABELS: {
  key: keyof Pick<ReturnType<typeof useAnalysisResult>, 'competitors' | 'density' | 'population'>
  label: string
}[] = [
  { key: 'competitors', label: '동일 업종 수' },
  { key: 'density', label: '경쟁 밀집도' },
  { key: 'population', label: '유동인구' },
]

function MetricValue({ card }: { card: MetricCard }) {
  if (card.status === 'idle') {
    return <p className="text-muted-foreground mt-0.5 text-sm">—</p>
  }

  if (card.status === 'loading') {
    return (
      <div className="mt-1 w-full space-y-1.5">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3 w-20 opacity-50" />
      </div>
    )
  }

  if (card.status === 'error') {
    return <p className="text-destructive mt-0.5 text-sm">오류</p>
  }

  const badgeColor = card.badgeTier ? BADGE_COLORS[card.badgeTier] : null

  return (
    <div className="mt-0.5">
      <p className="text-foreground text-sm font-semibold">{card.value ?? '—'}</p>
      {card.badge && badgeColor && (
        <span
          className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: badgeColor.bg, color: badgeColor.text }}
        >
          {card.badge}
        </span>
      )}
      {card.source && <p className="text-muted-foreground mt-0.5 text-[9px]">{card.source}</p>}
      {(card.status === 'fallback' || card.isFallback) && (
        <p className="mt-0.5 text-[9px] text-amber-600">유사 지역 기준</p>
      )}
    </div>
  )
}

export function MetricCards() {
  const result = useAnalysisResult()

  return (
    <div className="grid grid-cols-3 gap-2">
      {METRIC_LABELS.map(({ key, label }) => (
        <Card key={key}>
          <CardContent className="px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{label}</p>
            <MetricValue card={result[key]} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
