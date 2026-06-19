'use client'

import { Map } from 'react-kakao-maps-sdk'
import useKakaoLoader from '@/hooks/use-kakao-loader'

export function KakaoMap() {
  useKakaoLoader()

  return (
    <Map
      center={{ lat: 37.5665, lng: 126.978 }}
      style={{ width: '100%', height: '100%' }}
      level={3}
    />
  )
}