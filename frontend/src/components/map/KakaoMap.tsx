'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Circle, Map, useMap } from 'react-kakao-maps-sdk'
import useKakaoLoader from '@/hooks/use-kakao-loader'
import { useCompetitorClusterer } from '@/hooks/use-competitor-clusterer'
import { useAnalysisContext } from '@/store/analysisContext'
import { beginMapUpdate, completeMapUpdate, useAnalysisResult } from '@/store/analysisResult'
import { reverseGeocode } from '@/lib/geocode'
import { CandidatePin } from './CandidatePin'
import { CompetitorMarker } from './CompetitorMarker'
import { MapHints } from './MapHints'
import { KakaoMapProps } from '@/types/map'
import { CenterCoords, CompetitorItem } from '@/types/api'
import type { AnalysisContext } from '@/types/analysis'
import { CLUSTER_THRESHOLD, CLUSTER_MIN_LEVEL } from '@/constants/map'
import { INDIGO, MARKER_COLORS } from '@/styles/colors'

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }
const KOREA_LAT_RANGE = { min: 33, max: 39 }
const KOREA_LNG_RANGE = { min: 124, max: 132 }
const DRAG_END_DEBOUNCE_MS = 120
const DEFAULT_RADIUS_M = 500

type RadiusTier = {
  radius: number
  strokeColor: string
  strokeOpacity: number
  fillColor: string
  fillOpacity: number
  strokeWeight: number
  zIndex: number
}

function getZoomLevelForRadius(radius: number): number {
  if (radius <= 120) return 3
  if (radius <= 320) return 4
  return 5
}

function buildRadiusTiers(selectedRadius: number): RadiusTier[] {
  const middleRadius = Math.max(20, Math.round(selectedRadius * 0.6))
  const innerRadius = Math.max(10, Math.round(selectedRadius * 0.2))

  return [
    {
      radius: selectedRadius,
      strokeColor: INDIGO[600],
      strokeOpacity: 0.68,
      fillColor: INDIGO[600],
      fillOpacity: 0.05,
      strokeWeight: 1,
      zIndex: 10,
    },
    {
      radius: middleRadius,
      strokeColor: INDIGO[600],
      strokeOpacity: 0.48,
      fillColor: INDIGO[600],
      fillOpacity: 0.12,
      strokeWeight: 1,
      zIndex: 20,
    },
    {
      radius: innerRadius,
      strokeColor: INDIGO[600],
      strokeOpacity: 0.32,
      fillColor: INDIGO[600],
      fillOpacity: 0.22,
      strokeWeight: 1,
      zIndex: 30,
    },
  ]
}

function isWithinKoreaBounds(center: CenterCoords) {
  return (
    center.lat >= KOREA_LAT_RANGE.min &&
    center.lat <= KOREA_LAT_RANGE.max &&
    center.lng >= KOREA_LNG_RANGE.min &&
    center.lng <= KOREA_LNG_RANGE.max
  )
}

function toLatLng(center: CenterCoords) {
  return new window.kakao.maps.LatLng(center.lat, center.lng)
}

function getMarkerCenter(marker: kakao.maps.Marker): CenterCoords {
  const position = marker.getPosition()
  return {
    lat: position.getLat(),
    lng: position.getLng(),
  }
}

// ClustererLayer: Map 내부에서만 useMap() 호출 가능 — Map 자식으로 배치
// clusterMode=false 시 useCompetitorClusterer 내부에서 즉시 cleanup
function ClustererLayer({
  competitors,
  clusterMode,
  onRendered,
}: {
  competitors: CompetitorItem[]
  clusterMode: boolean
  onRendered?: () => void
}) {
  const map = useMap('ClustererLayer')
  useCompetitorClusterer(map, competitors, clusterMode, onRendered)
  return null
}

function CompetitorMarkerLayer({
  competitors,
  onRendered,
}: {
  competitors: CompetitorItem[]
  onRendered?: () => void
}) {
  useEffect(() => {
    if (!competitors.length) {
      onRendered?.()
      return
    }

    let frame1 = 0
    let frame2 = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          timeoutId = null
          onRendered?.()
        }, 0)
      })
    })

    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [competitors, onRendered])

  return (
    <>
      {competitors.map((c) => (
        <CompetitorMarker key={c.id} competitor={c} />
      ))}
    </>
  )
}

export function KakaoMap({ options, userLocation, isLoading }: KakaoMapProps) {
  const [sdkLoading] = useKakaoLoader()
  const { analysisContext, setAnalysisContext } = useAnalysisContext()
  const { mapSync } = useAnalysisResult()
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pendingCenter, setPendingCenter] = useState<CenterCoords | null>(null)
  const [previewCenter, setPreviewCenter] = useState<CenterCoords | null>(null)
  const centerMarkerRef = useRef<kakao.maps.Marker | null>(null)
  const centerMarkerCleanupRef = useRef<(() => void) | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedCenterRef = useRef<CenterCoords>(SEOUL_CENTER)
  const dragOriginRef = useRef<CenterCoords>(SEOUL_CENTER)
  const dragOriginContextRef = useRef<Pick<
    AnalysisContext,
    'center' | 'location' | 'dongCode' | 'fullLocationName'
  > | null>(null)
  const analysisContextRef = useRef(analysisContext)
  const renderCompleteTokenRef = useRef<number | null>(null)
  const renderCompleteFrameRef = useRef<number | null>(null)
  const currentCenter = analysisContext.center ?? options?.center ?? userLocation ?? SEOUL_CENTER
  const selectedRadius = analysisContext.radius ?? options?.radius_m ?? DEFAULT_RADIUS_M
  const radiusTiers = useMemo(() => buildRadiusTiers(selectedRadius), [selectedRadius])
  const competitorCount = options?.competitors.length ?? 0

  // 현재 지도 레벨 — 클러스터/개별 모드 전환 판단
  // onZoomChanged가 Map의 level prop 변경 시에도 발생하므로 별도 리셋 불필요
  const [currentLevel, setCurrentLevel] = useState(() => getZoomLevelForRadius(selectedRadius))
  const lastAppliedLevelRef = useRef<number | null>(null)

  const needsCluster = competitorCount >= CLUSTER_THRESHOLD

  // 클러스터 모드: 마커 50개 이상 AND 레벨이 CLUSTER_MIN_LEVEL 초과
  // 개별 모드: !clusterMode — 두 모드가 절대 동시에 활성화되지 않음
  const clusterMode = needsCluster && currentLevel > CLUSTER_MIN_LEVEL
  const individualMode = !clusterMode

  const handleZoomChanged = useCallback((target: kakao.maps.Map) => {
    setCurrentLevel(target.getLevel())
  }, [])

  const handleMapRendered = useCallback(() => {
    if (!mapSync.pending) return

    const token = renderCompleteTokenRef.current ?? mapSync.token
    renderCompleteTokenRef.current = token

    if (renderCompleteFrameRef.current != null) return

    renderCompleteFrameRef.current = requestAnimationFrame(() => {
      renderCompleteFrameRef.current = null

      window.setTimeout(() => {
        if (renderCompleteTokenRef.current !== token || !mapSync.pending) {
          return
        }

        completeMapUpdate(token)
        renderCompleteTokenRef.current = null
      }, 0)
    })
  }, [mapSync.pending, mapSync.token])

  useEffect(() => {
    if (!mapInstance) return
    const targetLevel = getZoomLevelForRadius(selectedRadius)
    if (lastAppliedLevelRef.current === targetLevel) return

    lastAppliedLevelRef.current = targetLevel
    if (mapInstance.getLevel() !== targetLevel) {
      mapInstance.setLevel(targetLevel, { animate: true })
    }
  }, [mapInstance, selectedRadius])

  const syncOverlays = useCallback((center: CenterCoords) => {
    if (!window.kakao?.maps) return

    const latLng = toLatLng(center)
    centerMarkerRef.current?.setPosition(latLng)
  }, [])

  const rollbackToCenter = useCallback(
    (center: CenterCoords) => {
      committedCenterRef.current = center
      syncOverlays(center)
      setPreviewCenter(null)
      setPendingCenter(null)
      setDragging(false)
      if (dragOriginContextRef.current) {
        setAnalysisContext(dragOriginContextRef.current)
      }
    },
    [setAnalysisContext, syncOverlays],
  )

  useEffect(() => {
    analysisContextRef.current = analysisContext
  }, [analysisContext])

  useEffect(() => {
    if (mapSync.pending) {
      renderCompleteTokenRef.current = mapSync.token
      return
    }

    renderCompleteTokenRef.current = null
    if (renderCompleteFrameRef.current != null) {
      cancelAnimationFrame(renderCompleteFrameRef.current)
      renderCompleteFrameRef.current = null
    }
  }, [mapSync.pending, mapSync.token])

  useEffect(() => {
    if (dragging || pendingCenter || previewCenter) return

    committedCenterRef.current = currentCenter
    syncOverlays(currentCenter)
  }, [
    currentCenter.lat,
    currentCenter.lng,
    dragging,
    pendingCenter,
    previewCenter,
    syncOverlays,
    currentCenter,
  ])

  useEffect(() => {
    return () => {
      centerMarkerCleanupRef.current?.()
      centerMarkerCleanupRef.current = null
      if (dragFrameRef.current != null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      if (dragEndTimerRef.current != null) {
        clearTimeout(dragEndTimerRef.current)
        dragEndTimerRef.current = null
      }
    }
  }, [])

  const handleRadiusCircleClick = useCallback(
    (radius: number) => {
      setAnalysisContext({ radius })

      const zoomLevel = getZoomLevelForRadius(radius)
      lastAppliedLevelRef.current = zoomLevel
      setCurrentLevel(zoomLevel)

      if (!mapInstance || !window.kakao?.maps) return

      const center = previewCenter ?? currentCenter
      const centerLatLng = new window.kakao.maps.LatLng(center.lat, center.lng)
      mapInstance.panTo(centerLatLng)
      mapInstance.setLevel(zoomLevel, { animate: true })
    },
    [currentCenter, mapInstance, previewCenter, setAnalysisContext],
  )

  const handleDrag = useCallback((marker: kakao.maps.Marker) => {
    if (dragFrameRef.current != null) return

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null
      const latLng = marker.getPosition()
      const nextCenter = { lat: latLng.getLat(), lng: latLng.getLng() }
      setPreviewCenter(nextCenter)
      setPendingCenter(nextCenter)
      syncOverlays(nextCenter)
    })
  }, [syncOverlays])

  const handleMarkerCreate = useCallback(
    (marker: kakao.maps.Marker) => {
      centerMarkerCleanupRef.current?.()
      centerMarkerRef.current = marker

      if (!window.kakao?.maps?.event) return

      const dragListener = () => handleDrag(marker)
      window.kakao.maps.event.addListener(marker, 'drag', dragListener)

      centerMarkerCleanupRef.current = () => {
        window.kakao.maps.event.removeListener(marker, 'drag', dragListener)
      }
    },
    [handleDrag],
  )

  const handleDragStart = useCallback((marker: kakao.maps.Marker) => {
    if (dragEndTimerRef.current != null) {
      clearTimeout(dragEndTimerRef.current)
      dragEndTimerRef.current = null
    }

    const origin = committedCenterRef.current
    dragOriginRef.current = origin
    dragOriginContextRef.current = {
      center: analysisContextRef.current.center,
      location: analysisContextRef.current.location,
      dongCode: analysisContextRef.current.dongCode,
      fullLocationName: analysisContextRef.current.fullLocationName,
    }
    setDragging(true)
    setPendingCenter(null)
    setPreviewCenter(origin)
    syncOverlays(origin)
    marker.setPosition(toLatLng(origin))
  }, [syncOverlays])

  const commitCenterChange = useCallback(
    async (center: CenterCoords) => {
      const context = analysisContextRef.current
      const origin = dragOriginRef.current

      if (!context.industry || !context.location) {
        setAnalysisContext({ center })
        committedCenterRef.current = center
        setPendingCenter(null)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPreviewCenter(null)
          })
        })
        return
      }

      try {
        beginMapUpdate('pin-move')
        setAnalysisContext({
          center,
          location: null,
          dongCode: null,
          fullLocationName: null,
        })
        committedCenterRef.current = center
        setPreviewCenter(center)
        syncOverlays(center)
        setPendingCenter(center)

        const geoResult = await reverseGeocode(center.lat, center.lng)

        if (!geoResult) {
          throw new Error('핀 위치의 지역 정보를 확인할 수 없습니다.')
        }

        setAnalysisContext({
          center,
          location: geoResult.dongName,
          dongCode: geoResult.dongCode,
          fullLocationName: geoResult.fullName,
        })
      } catch (error) {
        console.error('[map:pin-move] 지역 재확인 실패', error)
        rollbackToCenter(origin)
      }
    },
    [rollbackToCenter, setAnalysisContext, syncOverlays],
  )

  const handleDragEnd = useCallback(
    (marker: kakao.maps.Marker) => {
      if (dragEndTimerRef.current != null) {
        clearTimeout(dragEndTimerRef.current)
      }

      dragEndTimerRef.current = setTimeout(() => {
        dragEndTimerRef.current = null
        const center = getMarkerCenter(marker)
        setDragging(false)

        if (!isWithinKoreaBounds(center)) {
          rollbackToCenter(dragOriginRef.current)
          return
        }

        setPendingCenter(center)
        setPreviewCenter(center)
        syncOverlays(center)
        void commitCenterChange(center)
      }, DRAG_END_DEBOUNCE_MS)
    },
    [commitCenterChange, rollbackToCenter, syncOverlays],
  )

  const handleCancelCenterChange = useCallback(() => {
    rollbackToCenter(dragOriginRef.current)
  }, [rollbackToCenter])

  const visibleCenter = previewCenter ?? currentCenter

  // <Map>을 조건부로 마운트/언마운트하면 sdkLoading 전환 시점에 Kakao SDK 내부
  // 객체에 .state 접근 충돌이 발생한다. 항상 마운트 유지하고 overlay로 로딩 표시.
  return (
    <div className="relative min-h-0 flex-1">
      <Map
        center={currentCenter}
        className="h-full w-full"
        level={currentLevel}
        onCreate={setMapInstance}
        onZoomChanged={handleZoomChanged}
      >
        {/* SDK 준비 후에만 하위 Kakao 컴포넌트 렌더 */}
        {options && !sdkLoading && (
          <>
            {radiusTiers.map((tier, index) => (
              <Circle
                key={`${tier.radius}-${index}`}
                center={visibleCenter}
                radius={tier.radius}
                strokeWeight={tier.strokeWeight}
                strokeColor={tier.strokeColor}
                strokeOpacity={tier.strokeOpacity}
                strokeStyle="solid"
                fillColor={tier.fillColor}
                fillOpacity={tier.fillOpacity}
                zIndex={tier.zIndex}
                onClick={() => handleRadiusCircleClick(tier.radius)}
              />
            ))}

            {/* 후보지 핀 — 드래그 가능 */}
            <CandidatePin
              position={visibleCenter}
              draggable
              isDragging={dragging}
              onCreate={handleMarkerCreate}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />

            {/*
              클러스터 레이어 — needsCluster일 때 항상 마운트 유지
              clusterMode prop으로 활성/비활성 제어:
                true  → SDK 아이콘 마커 + 클러스터 집계 표시
                false → 내부에서 즉시 cleanup (마커·클러스터러 제거)
            */}
            {needsCluster && (
              <ClustererLayer
                competitors={options.competitors}
                clusterMode={clusterMode}
                onRendered={handleMapRendered}
              />
            )}

            {/*
              개별 마커 — individualMode일 때만 렌더링
              clusterMode와 항상 반대값이므로 동시 렌더링 불가
                50개 미만: needsCluster=false → clusterMode=false → 항상 표시
                50개 이상, 줌인(레벨 ≤4): clusterMode=false → 표시
                50개 이상, 줌아웃(레벨 >4): clusterMode=true → 렌더링 안 함
            */}
            {individualMode && (
              <CompetitorMarkerLayer
                competitors={options.competitors}
                onRendered={handleMapRendered}
              />
            )}
          </>
        )}
      </Map>

      <MapHints
        dragging={dragging}
        pending={pendingCenter != null}
        onCancel={handleCancelCenterChange}
      />

      {/* SDK 초기 로딩 오버레이 */}
      {sdkLoading && (
        <div className="bg-muted absolute inset-0 z-20 flex items-center justify-center rounded-lg">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {/* 초기 비활성 오버레이 */}
      {!sdkLoading && !options && !isLoading && (
        <div className="bg-background/50 pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
          <div className="border-border bg-background/80 flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 shadow-sm">
            <span className="text-foreground text-sm font-medium">창업 후보지를 분석해드릴게요</span>
            <span className="text-muted-foreground text-center text-xs leading-relaxed">
              {userLocation
                ? '업종과 창업 후보지를 알려주세요'
                : '에이전트에게 업종과 위치를 알려주세요'}
            </span>
          </div>
        </div>
      )}

      {/* 범례 */}
      {!sdkLoading && options && !isLoading && !mapSync.pending && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <div className="border-border bg-background/90 rounded-md border px-2.5 py-1.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
            <span className="text-muted-foreground">선택 반경</span>
            <span className="text-foreground ml-1">{selectedRadius}m</span>
          </div>
          <div className="border-border bg-background/90 flex flex-col gap-1.5 rounded-md border px-2.5 py-2 shadow-sm backdrop-blur-sm">
            <LegendItem color={MARKER_COLORS.candidate} label="내 후보지" />
            <LegendItem color={MARKER_COLORS.same} label="동일 업종" />
            <LegendItem color={MARKER_COLORS.similar} label="유사 업종" />
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground text-[10px]">{label}</span>
    </div>
  )
}
