import { Card, CardContent } from '@/components/ui/card'

const METRICS = [
  { label: '동일 업종 수', value: '—' },
  { label: '경쟁 밀집도', value: '—' },
  { label: '유동인구',    value: '—' },
] as const

export function MetricCards() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METRICS.map(({ label, value }) => (
        <Card key={label}>
          <CardContent className="px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
