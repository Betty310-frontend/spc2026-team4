'use client'

import { Map, Circle, CustomOverlayMap } from 'react-kakao-maps-sdk'
import { Loader2 } from 'lucide-react'
import useKakaoLoader from '@/hooks/use-kakao-loader'
import { KakaoMapProps } from '@/types/map'

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }

const MARKER_COLOR = {
  center: '#2563EB',
  same: '#E24B4A',
  similar: '#EF9F27',
} as const

export function KakaoMap({ options, userLocation, isLoading }: KakaoMapProps) {
  const [sdkLoading] = useKakaoLoader()

  // 우선순위: 분석 결과 > 현재 위치(GPS) > 서울 시청 기본값
  const mapCenter = options?.center ?? userLocation ?? SEOUL_CENTER
  // options 있음 → level 4 (분석 반경), userLocation → level 6 (동네), 기본 → level 7 (서울 전체)
  const mapLevel = options ? 4 : userLocation ? 6 : 7

  // <Map>을 조건부로 마운트/언마운트하면 sdkLoading 전환 시점에 Kakao SDK 내부
  // 객체에 .state 접근 충돌이 발생한다. 항상 마운트 유지하고 overlay로 로딩 표시.
  return (
    <div className="relative min-h-0 flex-1">
      <Map center={mapCenter} className="h-full w-full" level={mapLevel}>
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

            <CustomOverlayMap
              position={{ lat: options.center.lat, lng: options.center.lng }}
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

            {options.competitors.map((c) => (
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
