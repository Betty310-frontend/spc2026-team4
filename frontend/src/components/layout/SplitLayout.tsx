'use client'

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useRef, useState, useCallback, useEffect } from 'react'
import Topbar from './Topbar'
import ResizeHandle from './ResizeHandle'
import { SURFACE_MUTED, TEXT_MUTED } from '@/styles/colors'

interface SplitLayoutProps {
  left: ReactNode
  right: ReactNode
  showDisclaimer?: boolean
}

const MIN_RIGHT_PANEL_WIDTH = 240
const MAX_RIGHT_PANEL_WIDTH = 480

export default function SplitLayout({ left, right, showDisclaimer = false }: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rightPanelWidth, setRightPanelWidth] = useState(280)
  const isDragging = useRef(false)

  const clampRightPanelWidth = useCallback((nextWidth: number) => {
    if (!containerRef.current) return nextWidth

    const totalWidth = containerRef.current.offsetWidth
    const maxRight = Math.min(MAX_RIGHT_PANEL_WIDTH, Math.max(MIN_RIGHT_PANEL_WIDTH, totalWidth - 360))
    return Math.min(maxRight, Math.max(MIN_RIGHT_PANEL_WIDTH, nextWidth))
  }, [])

  useEffect(() => {
    const updateWidth = () => {
      setRightPanelWidth((currentWidth) => clampRightPanelWidth(currentWidth))
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => {
      window.removeEventListener('resize', updateWidth)
    }
  }, [clampRightPanelWidth])

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const startX = e.clientX
    const startWidth = rightPanelWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const newWidth = clampRightPanelWidth(startWidth + delta)
      setRightPanelWidth(newWidth)
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [clampRightPanelWidth, rightPanelWidth])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div className="flex h-full min-h-screen flex-col overflow-hidden bg-white">
      <Topbar />

      <div
        ref={containerRef}
        className="flex h-full min-h-0 flex-1 flex-col-reverse overflow-hidden md:flex-row"
      >
        {/* 좌측 패널 */}
        <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
          {left}
        </div>

        {/* 리사이즈 핸들 — md 이상에서만 노출 */}
        <div className="hidden md:block">
          <ResizeHandle onMouseDown={handleMouseDown} />
        </div>

        {/* 우측 에이전트 패널 */}
        <div
          className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden md:min-h-0"
          style={{ width: rightPanelWidth }}
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
