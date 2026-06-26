'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Circle, Map, useMap } from 'react-kakao-maps-sdk'
import useKakaoLoader from '@/hooks/use-kakao-loader'
import { useCompetitorClusterer } from '@/hooks/use-competitor-clusterer'
import { useAnalysisContext } from '@/store/analysisContext'
import { reverseGeocode } from '@/lib/geocode'
import { beginMapUpdate, completeMapUpdate, getCurrentMapToken } from '@/store/analysisResult'
import { CandidatePin } from './CandidatePin'
import { CompetitorMarker } from './CompetitorMarker'
import { MapHints } from './MapHints'
import { KakaoMapProps } from '@/types/map'
import { CenterCoords, CompetitorItem } from '@/types/api'
import { CLUSTER_THRESHOLD, CLUSTER_MIN_LEVEL } from '@/constants/map'
import { radiusToLevel } from '@/lib/radius-sync'
import { INDIGO, MARKER_COLORS } from '@/styles/colors'

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }
const KOREA_LAT_RANGE = { min: 33, max: 39 }
const KOREA_LNG_RANGE = { min: 124, max: 132 }
const DRAG_END_DEBOUNCE_MS = 400

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
}: {
  competitors: CompetitorItem[]
  clusterMode: boolean
}) {
  const map = useMap('ClustererLayer')
  useCompetitorClusterer(map, competitors, clusterMode)
  return null
}

export function KakaoMap({ options, userLocation, isLoading }: KakaoMapProps) {
  const [sdkLoading] = useKakaoLoader()
  const { analysisContext, setAnalysisContext } = useAnalysisContext()
  const [dragging, setDragging] = useState(false)
  const [pendingCenter, setPendingCenter] = useState<CenterCoords | null>(null)
  const [previewCenter, setPreviewCenter] = useState<CenterCoords | null>(null)
  const circleRef = useRef<kakao.maps.Circle | null>(null)
  const centerMarkerRef = useRef<kakao.maps.Marker | null>(null)
  const centerMarkerCleanupRef = useRef<(() => void) | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedCenterRef = useRef<CenterCoords>(SEOUL_CENTER)
  const dragOriginRef = useRef<CenterCoords>(SEOUL_CENTER)
  const analysisContextRef = useRef(analysisContext)
  const currentCenter = analysisContext.center ?? options?.center ?? userLocation ?? SEOUL_CENTER
  const displayRadiusM = analysisContext.radius ?? options?.radius_m ?? 500
  const derivedLevel =
    options || analysisContext.radius != null ? radiusToLevel(displayRadiusM) : userLocation ? 6 : 7
  const competitorCount = options?.competitors.length ?? 0

  // 현재 지도 레벨 — 클러스터/개별 모드 전환 판단
  // onZoomChanged가 Map의 level prop 변경 시에도 발생하므로 별도 리셋 불필요
  const [currentLevel, setCurrentLevel] = useState(derivedLevel)

  const needsCluster = competitorCount >= CLUSTER_THRESHOLD

  // 클러스터 모드: 마커 50개 이상 AND 레벨이 CLUSTER_MIN_LEVEL 초과
  // 개별 모드: !clusterMode — 두 모드가 절대 동시에 활성화되지 않음
  const clusterMode = needsCluster && currentLevel > CLUSTER_MIN_LEVEL
  const individualMode = !clusterMode

  const handleZoomChanged = useCallback((target: kakao.maps.Map) => {
    setCurrentLevel(target.getLevel())
  }, [])

  const syncOverlays = useCallback(
    (center: CenterCoords, radius = displayRadiusM) => {
      if (!window.kakao?.maps) return

      const latLng = toLatLng(center)
      circleRef.current?.setPosition(latLng)
      circleRef.current?.setRadius(radius)
      centerMarkerRef.current?.setPosition(latLng)
    },
    [displayRadiusM],
  )

  const rollbackToCenter = useCallback(
    (center: CenterCoords) => {
      committedCenterRef.current = center
      syncOverlays(center)
      setPreviewCenter(null)
      setPendingCenter(null)
      setDragging(false)
    },
    [syncOverlays],
  )

  useEffect(() => {
    analysisContextRef.current = analysisContext
  }, [analysisContext])

  useEffect(() => {
    // 반경 변경에 따라 지도의 기준 레벨을 외부 상태와 맞춘다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentLevel(derivedLevel)
  }, [derivedLevel])

  useEffect(() => {
    if (dragging || pendingCenter || previewCenter) return

    committedCenterRef.current = currentCenter
    syncOverlays(currentCenter, displayRadiusM)
  }, [
    currentCenter.lat,
    currentCenter.lng,
    displayRadiusM,
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

  const handleCircleCreate = useCallback((circle: kakao.maps.Circle) => {
    circleRef.current = circle
  }, [])

  const handleDrag = useCallback((marker: kakao.maps.Marker) => {
    if (dragFrameRef.current != null) return

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null
      const latLng = marker.getPosition()
      circleRef.current?.setPosition(latLng)
      centerMarkerRef.current?.setPosition(latLng)
    })
  }, [])

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
    setDragging(true)
    setPendingCenter(null)
    syncOverlays(origin)
    marker.setPosition(toLatLng(origin))
  }, [syncOverlays])

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

        syncOverlays(center)
        setPreviewCenter(center)
        setPendingCenter(center)
      }, DRAG_END_DEBOUNCE_MS)
    },
    [rollbackToCenter, syncOverlays],
  )

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
        const geoResult = await reverseGeocode(center.lat, center.lng)

        if (!geoResult) {
          throw new Error('핀 위치의 지역 정보를 확인할 수 없습니다.')
        }

        const nextToken = getCurrentMapToken() + 1
        beginMapUpdate('pin-move')
        setAnalysisContext({
          center,
          location: geoResult.dongName,
          dongCode: geoResult.dongCode,
          fullLocationName: geoResult.fullName,
        })

        committedCenterRef.current = center
        setPendingCenter(null)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPreviewCenter(null)
            completeMapUpdate(nextToken)
          })
        })
      } catch (error) {
        console.error('[map:pin-move] 지역 재확인 실패', error)
        rollbackToCenter(origin)
      }
    },
    [rollbackToCenter, setAnalysisContext],
  )

  const handleConfirmCenterChange = useCallback(() => {
    if (!pendingCenter) return
    void commitCenterChange(pendingCenter)
  }, [commitCenterChange, pendingCenter])

  const handleCancelCenterChange = useCallback(() => {
    rollbackToCenter(dragOriginRef.current)
  }, [rollbackToCenter])

  const visibleCenter = previewCenter ?? currentCenter

  // <Map>을 조건부로 마운트/언마운트하면 sdkLoading 전환 시점에 Kakao SDK 내부
  // 객체에 .state 접근 충돌이 발생한다. 항상 마운트 유지하고 overlay로 로딩 표시.
  return (
    <div className="relative min-h-0 flex-1">
      <Map center={currentCenter} className="h-full w-full" level={currentLevel} onZoomChanged={handleZoomChanged}>
        {/* SDK 준비 후에만 하위 Kakao 컴포넌트 렌더 */}
        {options && !sdkLoading && (
          <>
            <Circle
              center={visibleCenter}
              radius={displayRadiusM}
              strokeWeight={1.5}
              strokeColor={INDIGO[600]}
              strokeOpacity={0.8}
              strokeStyle="shortdash"
              fillColor={INDIGO[600]}
              fillOpacity={0.05}
              onCreate={handleCircleCreate}
            />

            {/* 후보지 핀 — 드래그 가능 */}
            <CandidatePin
              position={visibleCenter}
              draggable
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
              <ClustererLayer competitors={options.competitors} clusterMode={clusterMode} />
            )}

            {/*
              개별 마커 — individualMode일 때만 렌더링
              clusterMode와 항상 반대값이므로 동시 렌더링 불가
                50개 미만: needsCluster=false → clusterMode=false → 항상 표시
                50개 이상, 줌인(레벨 ≤4): clusterMode=false → 표시
                50개 이상, 줌아웃(레벨 >4): clusterMode=true → 렌더링 안 함
            */}
            {individualMode &&
              options.competitors.map((c) => <CompetitorMarker key={c.id} competitor={c} />)}
          </>
        )}
      </Map>

      <MapHints
        dragging={dragging}
        pending={pendingCenter != null}
        onConfirm={handleConfirmCenterChange}
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

      {/* 분석 중 오버레이 */}
      {!sdkLoading && isLoading && (
        <div className="bg-background/60 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          <span className="text-muted-foreground text-xs">데이터 수집 중…</span>
        </div>
      )}

      {/* 범례 */}
      {!sdkLoading && options && !isLoading && (
        <div className="border-border bg-background/90 absolute top-2 right-2 z-10 flex flex-col gap-1.5 rounded-md border px-2.5 py-2 shadow-sm backdrop-blur-sm">
          <LegendItem color={MARKER_COLORS.candidate} label="내 후보지" />
          <LegendItem color={MARKER_COLORS.same} label="동일 업종" />
          <LegendItem color={MARKER_COLORS.similar} label="유사 업종" />
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
