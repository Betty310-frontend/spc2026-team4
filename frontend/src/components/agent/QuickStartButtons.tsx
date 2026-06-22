import { Button } from '@/components/ui/button'

const QUICK_STARTS = [
  '🏪 성수동 카페 창업 예시 보기',
  '📚 목동 학원 창업 예시 보기',
  '✂️ 상계동 미용실 창업 예시 보기',
] as const

interface QuickStartButtonsProps {
  onSelect: (text: string) => void
}

export function QuickStartButtons({ onSelect }: QuickStartButtonsProps) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <span className="text-[10px] text-muted-foreground">빠른 시작</span>
      {QUICK_STARTS.map((text) => (
        <Button
          key={text}
          variant="outline"
          className="h-auto w-full justify-start py-2 text-left text-xs"
          onClick={() => onSelect(text)}
        >
          {text}
        </Button>
      ))}
    </div>
  )
}
