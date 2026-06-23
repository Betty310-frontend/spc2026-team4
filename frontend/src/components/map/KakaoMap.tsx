'use client'

import { Map, Circle, CustomOverlayMap } from 'react-kakao-maps-sdk'
import { Loader2 } from 'lucide-react'
import useKakaoLoader from '@/hooks/use-kakao-loader'
import { MapOptions } from '@/types/map'

interface KakaoMapProps {
  options: MapOptions | null
  isLoading?: boolean
}

const MARKER_COLOR = {
  center: '#2563EB',
  same: '#E24B4A',
  similar: '#EF9F27',
} as const

export function KakaoMap({ options, isLoading }: KakaoMapProps) {
  useKakaoLoader()

  if (!options) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-muted text-muted-foreground">
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">데이터 수집 중…</span>
          </>
        ) : (
          <>
            <span className="text-2xl">📍</span>
            <span className="text-xs">에이전트에게 창업 업종과 위치를 말해주세요</span>
          </>
        )}
      </div>
    )
  }

  const { center, radius_m, competitors } = options

  return (
    <div className="relative min-h-0 flex-1">
      <Map
        center={{ lat: center.lat, lng: center.lng }}
        className="h-full w-full"
        level={4}
      >
        {/* 반경 원 */}
        <Circle
          center={{ lat: center.lat, lng: center.lng }}
          radius={radius_m}
          strokeWeight={1.5}
          strokeColor={MARKER_COLOR.center}
          strokeOpacity={0.8}
          strokeStyle="shortdash"
          fillColor={MARKER_COLOR.center}
          fillOpacity={0.05}
        />

        {/* 후보지 핀 */}
        <CustomOverlayMap
          position={{ lat: center.lat, lng: center.lng }}
          yAnchor={0.5}
          xAnchor={0.5}
          zIndex={10}
        >
          <div
            style={{
              width: 14,
              height: 14,
              background: MARKER_COLOR.center,
              border: '2.5px solid #fff',
              borderRadius: '50%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        </CustomOverlayMap>

        {/* 경쟁업체 마커 */}
        {competitors.map((c) => (
          <CustomOverlayMap
            key={c.bizesId}
            position={{ lat: c.lat, lng: c.lng }}
            yAnchor={0.5}
            xAnchor={0.5}
            zIndex={5}
          >
            <div
              title={c.bizesNm}
              style={{
                width: 10,
                height: 10,
                background: c.type === 'same' ? MARKER_COLOR.same : MARKER_COLOR.similar,
                border: '1.5px solid #fff',
                borderRadius: '50%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            />
          </CustomOverlayMap>
        ))}
      </Map>

      {/* 로딩 오버레이 — options 있는데 재조회 중인 경우 */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">데이터 수집 중…</span>
        </div>
      )}

      {/* 범례 */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-2 shadow-sm backdrop-blur-sm">
        <LegendItem color={MARKER_COLOR.center} label="내 후보지" />
        <LegendItem color={MARKER_COLOR.same} label="동일 업종" />
        <LegendItem color={MARKER_COLOR.similar} label="유사 업종" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
