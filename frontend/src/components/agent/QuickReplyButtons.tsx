'use client'

import { Button } from '@/components/ui/button'

export type QuickReplyType =
  | 'operation'
  | 'breakeven'
  | 'differentiation'
  | 'radius'
  | 'report_offer'

export type QuickReplyAction = 'generate_report' | 'dismiss'

export interface QuickReplyOption {
  label: string
  text: string
  action?: QuickReplyAction
}

const QUICK_REPLY_MAP: Record<QuickReplyType, QuickReplyOption[]> = {
  operation: [
    { label: '직접 운영할 예정이에요', text: '직접 운영할 예정이에요.' },
    { label: '직원 고용도 생각 중이에요', text: '직원 고용도 생각하고 있어요.' },
    { label: '아직 결정 못 했어요', text: '아직 결정하지 못했어요.' },
  ],
  breakeven: [
    { label: '6개월 이내요', text: '6개월 이내를 목표로 하고 있어요.' },
    { label: '1년 정도 보고 있어요', text: '1년 정도를 보고 있어요.' },
    { label: '아직 계산 중이에요', text: '아직 정확히 계산해보지 못했어요.' },
  ],
  differentiation: [
    { label: '가격 경쟁력으로 승부할게요', text: '가격 경쟁력으로 승부하려고 해요.' },
    { label: '품질/서비스로 차별화할게요', text: '품질과 서비스로 차별화하려고 해요.' },
    { label: '아직 고민 중이에요', text: '아직 어떻게 차별화할지 고민 중이에요.' },
  ],
  radius: [
    { label: '반경 좁혀볼게요 (300m)', text: '300m로 반경을 줄여볼게요.' },
    { label: '반경 넓혀볼게요 (1km)', text: '1km로 반경을 넓혀볼게요.' },
    { label: '현재 반경 유지할게요', text: '현재 반경으로 유지할게요.' },
  ],
  report_offer: [
    { label: '📊 리포트 생성하기', text: '네, 리포트 생성해주세요.', action: 'generate_report' },
    { label: '반경 더 바꿔볼게요', text: '반경을 조금 더 바꿔보고 싶어요.' },
    { label: '나중에 할게요', text: '나중에 할게요.', action: 'dismiss' },
  ],
}

interface QuickReplyButtonsProps {
  type: QuickReplyType
  disabled?: boolean
  onSelect: (option: QuickReplyOption) => void
}

export function QuickReplyButtons({ type, disabled = false, onSelect }: QuickReplyButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_REPLY_MAP[type].map((option) => (
        <Button
          key={option.label}
          type="button"
          variant="outline"
          className="h-auto w-fit justify-start px-2 py-2 text-left text-xs font-medium"
          disabled={disabled}
          onClick={() => onSelect(option)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
