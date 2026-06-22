'use client'

import { useState } from 'react'
import { INDIGO, BORDER_SUBTLE } from '@/styles/colors'

interface ResizeHandleProps {
  onMouseDown: () => void
}

export default function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative h-full w-[4px] flex-shrink-0 cursor-col-resize transition-colors duration-150"
      style={{ background: isHovered ? INDIGO[400] : BORDER_SUBTLE }}
      role="separator"
      aria-orientation="vertical"
      aria-label="패널 너비 조절"
    >
      {/* 히트 영역 확장 — 핸들 좌우 6px */}
      <div className="absolute -inset-x-[6px] inset-y-0" />
    </div>
  )
}
