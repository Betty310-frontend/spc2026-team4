'use client'

import { useMemo } from 'react'
import { MapMarker } from 'react-kakao-maps-sdk'
import { INDIGO } from '@/styles/colors'

interface CandidatePinProps {
  position: { lat: number; lng: number }
  draggable?: boolean
  isDragging?: boolean
  zIndex?: number
  onCreate?: (marker: kakao.maps.Marker) => void
  onDragStart?: (marker: kakao.maps.Marker) => void
  onDragEnd?: (marker: kakao.maps.Marker) => void
}

function createPinImage(isDragging: boolean) {
  const body = isDragging ? INDIGO[400] : INDIGO[600]
  const shadowOpacity = isDragging ? 0.16 : 0.25
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46" fill="none">` +
    `<defs>` +
    `<filter id="shadow" x="-20%" y="-10%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#111827" flood-opacity="${shadowOpacity}" />` +
    `</filter>` +
    `</defs>` +
    `<path d="M17 44C17 44 4 29.3 4 18.6C4 11.2 9.8 5.4 17 5.4C24.2 5.4 30 11.2 30 18.6C30 29.3 17 44 17 44Z" fill="${body}" filter="url(#shadow)"/>` +
    `<circle cx="17" cy="18" r="6.2" fill="#ffffff" opacity="0.96"/>` +
    `<circle cx="17" cy="18" r="3.5" fill="${body}"/>` +
    `</svg>`

  return {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    size: { width: 34, height: 46 },
    options: {
      offset: { x: 17, y: 44 },
      alt: '분석 중심 핀',
    },
  }
}

export function CandidatePin({
  position,
  draggable = false,
  isDragging = false,
  zIndex = 10,
  onCreate,
  onDragStart,
  onDragEnd,
}: CandidatePinProps) {
  const image = useMemo(() => createPinImage(isDragging), [isDragging])

  return (
    <MapMarker
      position={position}
      image={image}
      draggable={draggable}
      clickable={false}
      opacity={isDragging ? 0.82 : 1}
      zIndex={zIndex}
      title="분석 중심 핀"
      onCreate={onCreate}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />
  )
}
