'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalysisResult, type MetricCard } from '@/store/analysisResult'
import { BADGE_COLORS } from '@/styles/colors'

type MetricKey = 'competitors' | 'density' | 'population'

const METRIC_META: Record<
  MetricKey,
  { label: string; unit: string; accent: string; valueTone: string }
> = {
  competitors: {
    label: '동일 업종 수',
    unit: '곳',
    accent: '#E24B4A',
    valueTone: 'text-[#7B1E1D]',
  },
  density: {
    label: '경쟁 밀집도',
    unit: 'P',
    accent: '#EF9F27',
    valueTone: 'text-[#5C3500]',
  },
  population: {
    label: '유동인구',
    unit: '명',
    accent: '#5C5FC4',
    valueTone: 'text-[#1F2366]',
  },
}

const METRIC_ORDER: MetricKey[] = ['competitors', 'density', 'population']

function formatMetric(card: MetricCard, unit: string) {
  if (card.status === 'idle') {
    return { value: '—', unit }
  }

  if (card.status === 'loading') {
    return null
  }

  if (card.status === 'error') {
    return { value: '오류', unit: '' }
  }

  return {
    value: card.value ?? '—',
    unit: card.unit ?? unit,
  }
}

function MetricValue({
  card,
  unit,
  tone,
}: {
  card: MetricCard
  unit: string
  tone: string
}) {
  if (card.status === 'loading') {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-end gap-1">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mb-1 h-4 w-6" />
        </div>
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-24 opacity-60" />
      </div>
    )
  }

  const formatted = formatMetric(card, unit)
  if (!formatted) return null

  const badgeColor = card.badgeTier ? BADGE_COLORS[card.badgeTier] : null

  return (
    <div className="mt-2">
      <div className="flex items-end gap-1">
        <span className={`text-2xl leading-none font-semibold tracking-tight ${tone}`}>
          {formatted.value}
        </span>
        {formatted.unit && (
          <span className="pb-0.5 text-xs font-medium text-muted-foreground">
            {formatted.unit}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.badge && badgeColor && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: badgeColor.bg, color: badgeColor.text }}
          >
            {card.badge}
          </span>
        )}
        {(card.status === 'fallback' || card.isFallback) && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            유사 지역 기준
          </span>
        )}
      </div>

      {card.source && (
        <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
          {card.source}
        </p>
      )}
    </div>
  )
}

export function MetricCards() {
  const result = useAnalysisResult()

  return (
    <div className="grid grid-cols-3 gap-2">
      {METRIC_ORDER.map((key) => {
        const meta = METRIC_META[key]
        const card = result[key]

        return (
          <Card
            key={key}
            size="sm"
            className="relative overflow-hidden border-border/70 bg-gradient-to-br from-white to-muted/30 shadow-sm"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.accent }} />
            <CardContent className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
              </div>
              <MetricValue card={card} unit={meta.unit} tone={meta.valueTone} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
