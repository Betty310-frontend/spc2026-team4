'use client'

import { MapPin, RotateCcw, Sparkles } from 'lucide-react'
import { BORDER_SUBTLE, INDIGO, SURFACE_MUTED, TEXT_SECONDARY, WHITE, YELLOW } from '@/styles/colors'

interface MapHintsProps {
  dragging: boolean
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function MapHints({ dragging, pending, onConfirm, onCancel }: MapHintsProps) {
  if (!dragging && !pending) return null

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col items-start gap-2">
      {dragging && (
        <div
          data-testid="map-dragging-hint"
          className="pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm"
          style={{
            borderColor: `${YELLOW[600]}33`,
            background: `${SURFACE_MUTED}f2`,
            color: YELLOW[800],
          }}
        >
          <MapPin className="h-3 w-3" />
          <span>위치 조정 중...</span>
        </div>
      )}

      {pending && (
        <div
          data-testid="map-drag-confirm"
          className="pointer-events-auto flex max-w-[calc(100%-12px)] items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{
            borderColor: BORDER_SUBTLE,
            background: SURFACE_MUTED,
          }}
        >
          <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: INDIGO[600] }} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold" style={{ color: INDIGO[900] }}>
              여기로 분석할까요?
            </p>
            <p className="text-[10px]" style={{ color: TEXT_SECONDARY }}>
              핀을 옮긴 위치로 지도와 결과를 다시 맞춥니다.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                borderColor: BORDER_SUBTLE,
                background: SURFACE_MUTED,
                color: TEXT_SECONDARY,
              }}
            >
              <RotateCcw className="h-3 w-3" />
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: INDIGO[600],
                color: WHITE,
              }}
            >
              <Sparkles className="h-3 w-3" />
              예
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
