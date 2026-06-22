'use client'

import { ReactNode, useRef, useState, useCallback, useEffect } from 'react'
import Topbar from './Topbar'
import ResizeHandle from './ResizeHandle'
import { SURFACE_MUTED, TEXT_MUTED } from '@/styles/colors'

interface SplitLayoutProps {
  left: ReactNode
  right: ReactNode
  showDisclaimer?: boolean
}

const RIGHT_PANEL_MIN = 200
const LEFT_PANEL_MIN = 360

export default function SplitLayout({ left, right, showDisclaimer = false }: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState<number | null>(null)
  const isDragging = useRef(false)

  // 초기 너비: 컨테이너 너비 - 280px (우측 패널 기본값)
  useEffect(() => {
    if (!containerRef.current) return
    const totalWidth = containerRef.current.offsetWidth
    setLeftWidth(totalWidth - 280)
  }, [])

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const containerLeft = containerRef.current.getBoundingClientRect().left
    const totalWidth = containerRef.current.offsetWidth
    const newLeftWidth = e.clientX - containerLeft

    const maxLeft = totalWidth - RIGHT_PANEL_MIN
    const clamped = Math.max(LEFT_PANEL_MIN, Math.min(newLeftWidth, maxLeft))
    setLeftWidth(clamped)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <Topbar />

      <div
        ref={containerRef}
        className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row"
        style={{ visibility: leftWidth == null ? 'hidden' : 'visible' }}
      >
        {/* 좌측 패널 */}
        <div
          className="min-h-[40vh] flex-shrink-0 overflow-y-auto md:min-h-0"
          style={{
            width: leftWidth != null ? `${leftWidth}px` : undefined,
            flex: leftWidth == null ? '1' : undefined,
          }}
        >
          {left}
        </div>

        {/* 리사이즈 핸들 — md 이상에서만 노출 */}
        <div className="hidden md:block">
          <ResizeHandle onMouseDown={handleMouseDown} />
        </div>

        {/* 우측 에이전트 패널 */}
        <div
          className="flex min-h-[45vh] flex-1 flex-col overflow-hidden md:min-h-0"
          style={{ minWidth: `${RIGHT_PANEL_MIN}px` }}
        >
          {right}
        </div>
      </div>

      {showDisclaimer && (
        <div
          className="flex-shrink-0 border-t border-black/[0.11] px-3 py-[6px] text-[8.5px] leading-relaxed"
          style={{ background: SURFACE_MUTED, color: TEXT_MUTED }}
        >
          이 서비스는 창업 리스크 해석을 위한 참고 자료를 제공합니다. 성공을 보장하지 않으며,
          재무·법률 조언이 아닙니다. 분석 결과는 공공 데이터 기준이며 실제와 다를 수 있습니다.
        </div>
      )}
    </div>
  )
}
