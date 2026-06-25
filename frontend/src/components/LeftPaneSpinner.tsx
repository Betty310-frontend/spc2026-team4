'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAnalysisResult } from '@/store/analysisResult'

const SHOW_DELAY_MS = 150
const MIN_VISIBLE_MS = 300

export function LeftPaneSpinner() {
  const { mapSync, chatLoading } = useAnalysisResult()
  const [visible, setVisible] = useState(false)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleSinceRef = useRef<number | null>(null)

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    clearTimers()

    const active = mapSync.pending || chatLoading

    if (active) {
      if (!visible) {
        showTimerRef.current = setTimeout(() => {
          visibleSinceRef.current = Date.now()
          setVisible(true)
        }, SHOW_DELAY_MS)
      }

      return clearTimers
    }

    if (!visible) {
      return clearTimers
    }

    const visibleSince = visibleSinceRef.current ?? Date.now()
    const elapsed = Date.now() - visibleSince
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)

    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      visibleSinceRef.current = null
    }, remaining)

    return clearTimers
  }, [mapSync.pending, chatLoading, visible])

  if (!visible) return null

  return (
    <div
      data-testid="leftpane-spinner"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      <div className="bg-background/70 border-border flex items-center gap-2 rounded-full border px-4 py-2 shadow-md backdrop-blur-sm">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-xs font-medium">지도 반영 중…</span>
      </div>
    </div>
  )
}
