'use client'

import { useMemo } from 'react'
import { CustomOverlayMap, MapMarker } from 'react-kakao-maps-sdk'
import { INDIGO } from '@/styles/colors'

interface CandidatePinProps {
  position: { lat: number; lng: number }
  draggable?: boolean
  zIndex?: number
  onCreate?: (marker: kakao.maps.Marker) => void
  onDragStart?: (marker: kakao.maps.Marker) => void
  onDragEnd?: (marker: kakao.maps.Marker) => void
}

function createDragHandleImage() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">` +
    `<circle cx="9" cy="9" r="6.5" fill="${INDIGO[600]}" stroke="#ffffff" stroke-width="2"/>` +
    `</svg>`

  return {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    size: { width: 18, height: 18 },
    options: {
      offset: { x: 9, y: 9 },
      alt: '중심 위치 핀',
    },
  }
}

export function CandidatePin({
  position,
  draggable = false,
  zIndex = 10,
  onCreate,
  onDragStart,
  onDragEnd,
}: CandidatePinProps) {
  const image = useMemo(() => createDragHandleImage(), [])

  return (
    <>
      <CustomOverlayMap position={position} yAnchor={0.5} xAnchor={0.5} zIndex={zIndex}>
        <div className="relative flex items-center justify-center" style={{ pointerEvents: 'none' }}>
          <span
            className="absolute inline-flex animate-ping rounded-full"
            style={{
              width: 32,
              height: 32,
              background: INDIGO[600],
              opacity: 0.4,
              animationDuration: '1.8s',
              pointerEvents: 'none',
            }}
          />
          <span
            className="absolute inline-flex animate-ping rounded-full"
            style={{
              width: 46,
              height: 46,
              background: INDIGO[600],
              opacity: 0.2,
              animationDuration: '1.8s',
              animationDelay: '0.4s',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              background: INDIGO[600],
              border: '3px solid #fff',
              borderRadius: '50%',
              boxShadow: '0 2px 6px rgba(37,99,235,0.5)',
              position: 'relative',
              zIndex: 1,
              pointerEvents: 'auto',
            }}
          />
        </div>
      </CustomOverlayMap>

      {draggable && (
        <MapMarker
          position={position}
          image={image}
          draggable
          clickable={false}
          opacity={0.01}
          zIndex={zIndex + 1}
          title="분석 중심 핀"
          onCreate={onCreate}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      )}
    </>
  )
}
