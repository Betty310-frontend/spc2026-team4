export interface GeoResult {
  dongName: string // 예: "연남동"
  dongCode: string // population API용 8자리 코드 예: "11440710"
  fullName: string // 예: "서울 마포구 연남동"
}

interface KakaoRegionCode {
  region_type: 'B' | 'H' | string
  region_1depth_name?: string
  region_2depth_name?: string
  region_3depth_name?: string
  code?: string
}

interface KakaoGeocoderServices {
  Status: { OK: string }
  Geocoder: new () => {
    coord2RegionCode: (
      lng: number,
      lat: number,
      callback: (result: KakaoRegionCode[], status: string) => void,
    ) => void
  }
}

interface KakaoMapsSdk {
  maps?: {
    services?: KakaoGeocoderServices
  }
}

interface KakaoWindow extends Window {
  kakao?: KakaoMapsSdk
}

function normalizeRegionCode(code: unknown): string | null {
  if (typeof code !== 'string' || code.length < 2) return null
  return code.slice(0, -2)
}

/**
 * 카카오맵 SDK Geocoder — 좌표 → 행정동명 역지오코딩
 * REST API 키 불필요. use-kakao-loader에 'services' 라이브러리 포함 필수.
 * 인자 순서 주의: coord2RegionCode(경도, 위도, callback)
 */
export function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  return new Promise((resolve) => {
    const kakaoMaps = (window as KakaoWindow).kakao?.maps
    const services = kakaoMaps?.services

    if (!services) {
      console.warn('[geocode] kakao.maps.services 미로드 — services 라이브러리를 확인하세요.')
      resolve(null)
      return
    }

    const geocoder = new services.Geocoder()

    geocoder.coord2RegionCode(lng, lat, (result: KakaoRegionCode[], status: string) => {
      if (status !== services.Status.OK) {
        resolve(null)
        return
      }

      // region_type 'B' = 행정동, 'H' = 법정동
      // 화면 표시는 행정동(B) 기준을 유지하고, population API에는 법정동(H) 기반 8자리 코드를 사용한다.
      const adminRegion = result.find((r) => r.region_type === 'B') ?? result[0]
      const legalRegion = result.find((r) => r.region_type === 'H') ?? adminRegion

      if (!adminRegion || !legalRegion) {
        resolve(null)
        return
      }

      resolve({
        dongName: adminRegion.region_3depth_name as string,
        dongCode: normalizeRegionCode(legalRegion.code) ?? '',
        fullName: [
          adminRegion.region_1depth_name,
          adminRegion.region_2depth_name,
          adminRegion.region_3depth_name,
        ]
          .filter(Boolean)
          .join(' '),
      })
    })
  })
}
