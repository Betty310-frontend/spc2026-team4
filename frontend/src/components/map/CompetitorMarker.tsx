'use client'

import { useState } from 'react'
import { CustomOverlayMap } from 'react-kakao-maps-sdk'
import { Competitor } from '@/types/api'
import { getIndustryIcon } from '@/constants/industry-icons'

const COLOR = {
  same: { bg: '#E24B4A', shadow: 'rgba(226,75,74,0.45)' },
  similar: { bg: '#EF9F27', shadow: 'rgba(239,159,39,0.45)' },
} as const

interface CompetitorMarkerProps {
  competitor: Competitor
}

export function CompetitorMarker({ competitor: c }: CompetitorMarkerProps) {
  const [hovered, setHovered] = useState(false)
  const color = COLOR[c.type]
  const icon = getIndustryIcon(c.indsMclsNm, c.indsSclsNm)

  return (
    <CustomOverlayMap
      position={{ lat: c.lat, lng: c.lng }}
      yAnchor={0.5}
      xAnchor={0.5}
      zIndex={hovered ? 20 : 5}
    >
      <div
        className="relative flex flex-col items-center"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 툴팁 — 호버 시만 표시 */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '6px 10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap',
              zIndex: 30,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#111827',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.bizesNm}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>
              {c.indsSclsNm ?? c.indsMclsNm ?? '업종 정보 없음'}
            </div>
            {c.rdnmAdr && (
              <div
                style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  marginTop: 1,
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.rdnmAdr}
              </div>
            )}
            <div
              style={{
                marginTop: 4,
                display: 'inline-block',
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 99,
                background: c.type === 'same' ? '#fef2f2' : '#fffbeb',
                color: c.type === 'same' ? '#b91c1c' : '#92400e',
              }}
            >
              {c.type === 'same' ? '동일 업종' : '유사 업종'}
            </div>
            {/* 툴팁 꼬리 */}
            <div
              style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 8,
                height: 8,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderTop: 'none',
                borderLeft: 'none',
                rotate: '45deg',
              }}
            />
          </div>
        )}

        {/* 마커 본체 — 크기 고정, 아이콘 항상 표시, 호버 시 그림자만 변화 */}
        <div
          style={{
            width: 22,
            height: 22,
            background: color.bg,
            border: '2px solid #fff',
            borderRadius: '50%',
            boxShadow: hovered ? `0 3px 10px ${color.shadow}` : '0 1px 3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            lineHeight: 1,
            transition: 'box-shadow 0.15s ease',
          }}
        >
          {icon}
        </div>
      </div>
    </CustomOverlayMap>
  )
}
