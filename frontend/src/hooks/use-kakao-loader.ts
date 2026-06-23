'use client'

import { useKakaoLoader as useKakaoLoaderOrigin } from 'react-kakao-maps-sdk'

export default function useKakaoLoader() {
  return useKakaoLoaderOrigin({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY as string,
    libraries: ['services', 'clusterer'],
  })
}
