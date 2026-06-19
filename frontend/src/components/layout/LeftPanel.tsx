import { ReactNode } from 'react'

interface LeftPanelProps {
  children: ReactNode
}

export default function LeftPanel({ children }: LeftPanelProps) {
  return <div className="flex h-full flex-col gap-2 p-[10px]">{children}</div>
}

export function AnalysisDivider() {
  return (
    <div className="mt-1 border-t border-black/[0.11] pt-2">
      <p className="mb-1 text-[7.5px] font-semibold tracking-[0.06em] text-[#999] uppercase">
        경영 분석 — 스크롤로 확인
      </p>
    </div>
  )
}

export function ScrollHint() {
  return (
    <div className="flex items-center justify-center gap-1 border-t border-black/[0.11] py-1 text-[8px] text-[#999]">
      <span>↓</span>
      <span>경영 분석 영역 스크롤</span>
    </div>
  )
}
