'use client'

import { useEffect, useRef } from 'react'
import { Competitor } from '@/types/api'
import { getIndustryIcon } from '@/constants/industry-icons'
import { CLUSTER_MIN_LEVEL, CLUSTER_THRESHOLD } from '@/constants/map'

export { CLUSTER_THRESHOLD }

// 클러스터 배지 스타일 — 마커 수 구간별 크기·색상 확대
const CLUSTER_STYLES = [
  {
    width: '36px',
    height: '36px',
    background: 'rgba(226,75,74,0.90)',
    borderRadius: '50%',
    border: '2px solid #fff',
    color: '#fff',
    lineHeight: '32px',
    textAlign: 'center' as const,
    fontSize: '12px',
    fontWeight: '600',
  },
  {
    width: '44px',
    height: '44px',
    background: 'rgba(226,75,74,0.95)',
    borderRadius: '50%',
    border: '2px solid #fff',
    color: '#fff',
    lineHeight: '40px',
    textAlign: 'center' as const,
    fontSize: '13px',
    fontWeight: '600',
  },
  {
    width: '52px',
    height: '52px',
    background: 'rgba(180,40,40,0.95)',
    borderRadius: '50%',
    border: '2px solid #fff',
    color: '#fff',
    lineHeight: '48px',
    textAlign: 'center' as const,
    fontSize: '14px',
    fontWeight: '700',
  },
]

// 업종 아이콘 이모지가 포함된 SVG 마커 이미지
// 클러스터 미형성 단독 마커에도 아이콘이 표시됨
function createMarkerSVG(c: Competitor): string {
  const fill = c.type === 'same' ? '#E24B4A' : '#EF9F27'
  const icon = getIndustryIcon(c.indsMclsNm, c.indsSclsNm)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">` +
    `<circle cx="14" cy="14" r="12" fill="${fill}" stroke="#fff" stroke-width="2"/>` +
    `<foreignObject x="4" y="4" width="20" height="20">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:20px;height:20px;display:flex;` +
    `align-items:center;justify-content:center;font-size:12px;line-height:1;">${icon}</div>` +
    `</foreignObject>` +
    `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export function useCompetitorClusterer(
  map: kakao.maps.Map | null,
  competitors: Competitor[],
  enabled: boolean,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustererRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakaoMaps = (window as any).kakao?.maps

    if (!map || !enabled) {
      // 비활성화 시 클러스터러·마커 즉시 정리
      if (clustererRef.current) {
        clustererRef.current.clear()
        clustererRef.current.setMap(null)
        clustererRef.current = null
      }
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      return
    }

    if (!kakaoMaps?.MarkerClusterer) return

    // 이전 클러스터러 정리
    if (clustererRef.current) {
      clustererRef.current.clear()
      clustererRef.current.setMap(null)
      clustererRef.current = null
    }
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    // 아이콘 SVG 마커 생성 — 클러스터 미형성 단독 마커도 아이콘 표시
    const markers = competitors.map((c) => {
      const image = new window.kakao.maps.MarkerImage(
        createMarkerSVG(c),
        new window.kakao.maps.Size(28, 28),
        { offset: new window.kakao.maps.Point(14, 14) },
      )
      return new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(c.lat, c.lng),
        image,
        title: c.bizesNm,
      })
    })
    markersRef.current = markers

    clustererRef.current = new kakaoMaps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: CLUSTER_MIN_LEVEL,
      minClusterSize: 3,
      disableClickZoom: false,
      styles: CLUSTER_STYLES,
    })

    clustererRef.current.addMarkers(markers)

    // 클러스터 클릭 시 줌인 — SDK가 자동 처리하지 않으므로 직접 등록
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleClusterClick = (cluster: any) => {
      const bounds = cluster.getBounds()
      map.setBounds(bounds, 50, 50, 50, 50)

      setTimeout(() => {
        if (map.getLevel() > CLUSTER_MIN_LEVEL) {
          map.setLevel(map.getLevel() - 1, {
            anchor: cluster.getCenter(),
            animate: true,
          })
        }
      }, 300)
    }

    kakaoMaps.event.addListener(clustererRef.current, 'clusterclick', handleClusterClick)

    return () => {
      if (clustererRef.current) {
        kakaoMaps.event.removeListener(
          clustererRef.current,
          'clusterclick',
          handleClusterClick,
        )
        clustererRef.current.clear()
        clustererRef.current.setMap(null)
        clustererRef.current = null
      }
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, competitors, enabled])
}
