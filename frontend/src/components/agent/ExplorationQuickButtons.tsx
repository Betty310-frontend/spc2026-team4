import { Button } from '@/components/ui/button'
import type { ExplorationMessageType } from '@/types/message'

type ExplorationButtonValue = number | string

const EXPLORATION_QUICK_BUTTONS: Record<
  ExplorationMessageType,
  Array<{ label: string; value: ExplorationButtonValue }>
> = {
  ask_radius: [
    { label: '🔍 100m로 좁혀볼게요', value: 100 },
    { label: '🔍 300m로 볼게요', value: 300 },
    { label: '🔍 500m 유지할게요', value: 500 },
    { label: '🔍 1km로 넓혀볼게요', value: 1000 },
  ],
  ask_population: [
    { label: '⏰ 출퇴근 시간대가 궁금해요', value: 'commute' },
    { label: '⏰ 점심 시간대가 궁금해요', value: 'lunch' },
    { label: '⏰ 저녁 시간대가 궁금해요', value: 'evening' },
    { label: '⏰ 주말 유동인구가 궁금해요', value: 'weekend' },
  ],
  competition: [
    { label: '🗺 지도에서 직접 확인할게요', value: 'map' },
    { label: '📊 리포트로 상세히 볼게요', value: 'report' },
    { label: '🔄 반경을 바꿔볼게요', value: 'radius' },
  ],
  report_offer: [
    { label: '📊 리포트 생성하기', value: 'generate' },
    { label: '🔄 반경 더 바꿔볼게요', value: 'explore_more' },
    { label: '나중에 할게요', value: 'dismiss' },
  ],
}

interface ExplorationQuickButtonsProps {
  type: ExplorationMessageType
  disabled?: boolean
  onSelect: (value: ExplorationButtonValue) => void
}

export function ExplorationQuickButtons({
  type,
  disabled = false,
  onSelect,
}: ExplorationQuickButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXPLORATION_QUICK_BUTTONS[type].map((btn) => (
        <Button
          key={btn.value}
          type="button"
          variant="outline"
          className="h-auto w-fit justify-start px-2 py-2 text-xs font-medium"
          disabled={disabled}
          onClick={() => onSelect(btn.value)}
        >
          {btn.label}
        </Button>
      ))}
    </div>
  )
}
