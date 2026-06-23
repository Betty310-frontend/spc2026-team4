'use client'

import { CustomOverlayMap } from 'react-kakao-maps-sdk'

interface CandidatePinProps {
  position: { lat: number; lng: number }
}

export function CandidatePin({ position }: CandidatePinProps) {
  return (
    <CustomOverlayMap position={position} yAnchor={0.5} xAnchor={0.5} zIndex={10}>
      {/* pointerEvents none — 펄스 링이 클러스터 레이어 클릭 차단하는 문제 방지 */}
      <div
        className="relative flex items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        {/* 펄스 링 1 */}
        <span
          className="absolute inline-flex animate-ping rounded-full"
          style={{
            width: 32,
            height: 32,
            background: '#2563EB',
            opacity: 0.4,
            animationDuration: '1.8s',
            pointerEvents: 'none',
          }}
        />
        {/* 펄스 링 2 — 딜레이로 파동 시차 */}
        <span
          className="absolute inline-flex animate-ping rounded-full"
          style={{
            width: 46,
            height: 46,
            background: '#2563EB',
            opacity: 0.2,
            animationDuration: '1.8s',
            animationDelay: '0.4s',
            pointerEvents: 'none',
          }}
        />
        {/* 핀 본체 — 클릭 이벤트 수신 */}
        <div
          style={{
            width: 16,
            height: 16,
            background: '#2563EB',
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
  )
}
