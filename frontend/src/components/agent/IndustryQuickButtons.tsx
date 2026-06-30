import { Button } from '@/components/ui/button'

const INDUSTRY_QUICK_OPTIONS = [
  { label: '☕ 카페', value: '카페' },
  { label: '🍽 음식점', value: '음식점' },
  { label: '💇 미용실', value: '미용실' },
  { label: '📚 학원', value: '학원' },
] as const

interface IndustryQuickButtonsProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

export function IndustryQuickButtons({ onSelect, disabled = false }: IndustryQuickButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {INDUSTRY_QUICK_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          className="h-auto w-fit justify-start px-2 py-2 text-xs font-medium"
          disabled={disabled}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
