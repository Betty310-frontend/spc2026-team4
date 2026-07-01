import { Button } from '@/components/ui/button'

const QUICK_STARTS = [
  { label: '🏪 성수동 카페 창업 예시 보기', location: '성수동', category: '카페' },
  { label: '📚 목동 학원 창업 예시 보기', location: '목동', category: '학원' },
  { label: '✂️ 상계동 미용실 창업 예시 보기', location: '상계동', category: '미용실' },
] as const

interface QuickStartButtonsProps {
  onSelect: (location: string, category: string) => void
}

export function QuickStartButtons({ onSelect }: QuickStartButtonsProps) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <span className="text-[10px] text-muted-foreground">빠른 시작</span>
      {QUICK_STARTS.map((option) => (
        <Button
          key={option.label}
          variant="outline"
          className="h-auto w-full justify-start py-2 text-left text-xs"
          onClick={() => onSelect(option.location, option.category)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
