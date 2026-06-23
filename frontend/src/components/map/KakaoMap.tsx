'use client'

import { Map, Circle, useMap } from 'react-kakao-maps-sdk'
import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import useKakaoLoader from '@/hooks/use-kakao-loader'
import { useCompetitorClusterer } from '@/hooks/use-competitor-clusterer'
import { CandidatePin } from './CandidatePin'
import { CompetitorMarker } from './CompetitorMarker'
import { KakaoMapProps } from '@/types/map'
import { Competitor } from '@/types/api'
import { CLUSTER_THRESHOLD, CLUSTER_MIN_LEVEL } from '@/constants/map'

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }

const MARKER_COLOR = {
  center: '#2563EB',
  same: '#E24B4A',
  similar: '#EF9F27',
} as const

// ClustererLayer: Map 내부에서만 useMap() 호출 가능 — Map 자식으로 배치
// clusterMode=false 시 useCompetitorClusterer 내부에서 즉시 cleanup
function ClustererLayer({
  competitors,
  clusterMode,
}: {
  competitors: Competitor[]
  clusterMode: boolean
}) {
  const map = useMap('ClustererLayer')
  useCompetitorClusterer(map, competitors, clusterMode)
  return null
}

export function KakaoMap({ options, userLocation, isLoading }: KakaoMapProps) {
  const [sdkLoading] = useKakaoLoader()

  // 우선순위: 분석 결과 > 현재 위치(GPS) > 서울 시청 기본값
  const mapCenter = options?.center ?? userLocation ?? SEOUL_CENTER
  const initialLevel = options ? 4 : userLocation ? 6 : 7

  // 현재 지도 레벨 — 클러스터/개별 모드 전환 판단
  // onZoomChanged가 Map의 level prop 변경 시에도 발생하므로 별도 리셋 불필요
  const [currentLevel, setCurrentLevel] = useState(initialLevel)

  const needsCluster = (options?.competitors.length ?? 0) >= CLUSTER_THRESHOLD

  // 클러스터 모드: 마커 50개 이상 AND 레벨이 CLUSTER_MIN_LEVEL 초과
  // 개별 모드: !clusterMode — 두 모드가 절대 동시에 활성화되지 않음
  const clusterMode = needsCluster && currentLevel > CLUSTER_MIN_LEVEL
  const individualMode = !clusterMode

  const handleZoomChanged = useCallback((target: kakao.maps.Map) => {
    setCurrentLevel(target.getLevel())
  }, [])

  // <Map>을 조건부로 마운트/언마운트하면 sdkLoading 전환 시점에 Kakao SDK 내부
  // 객체에 .state 접근 충돌이 발생한다. 항상 마운트 유지하고 overlay로 로딩 표시.
  return (
    <div className="relative min-h-0 flex-1">
      <Map
        center={mapCenter}
        className="h-full w-full"
        level={initialLevel}
        onZoomChanged={handleZoomChanged}
      >
        {/* SDK 준비 후에만 하위 Kakao 컴포넌트 렌더 */}
        {options && !sdkLoading && (
          <>
            <Circle
              center={{ lat: options.center.lat, lng: options.center.lng }}
              radius={options.radius_m}
              strokeWeight={1.5}
              strokeColor={MARKER_COLOR.center}
              strokeOpacity={0.8}
              strokeStyle="shortdash"
              fillColor={MARKER_COLOR.center}
              fillOpacity={0.05}
            />

            {/* 후보지 핀 — 항상 표시 */}
            <CandidatePin
              position={{ lat: options.center.lat, lng: options.center.lng }}
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
              />
            )}

            {/*
              개별 마커 — individualMode일 때만 렌더링
              clusterMode와 항상 반대값이므로 동시 렌더링 불가
                50개 미만: needsCluster=false → clusterMode=false → 항상 표시
                50개 이상, 줌인(레벨 ≤4): clusterMode=false → 표시
                50개 이상, 줌아웃(레벨 >4): clusterMode=true → 렌더링 안 함
            */}
            {individualMode &&
              options.competitors.map((c) => (
                <CompetitorMarker key={c.bizesId} competitor={c} />
              ))}
          </>
        )}
      </Map>

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
            <span className="text-foreground text-sm font-medium">
              창업 후보지를 분석해드릴게요
            </span>
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
          <LegendItem color={MARKER_COLOR.center} label="내 후보지" />
          <LegendItem color={MARKER_COLOR.same} label="동일 업종" />
          <LegendItem color={MARKER_COLOR.similar} label="유사 업종" />
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
