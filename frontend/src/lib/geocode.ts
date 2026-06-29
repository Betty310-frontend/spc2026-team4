export interface GeoResult {
  dongName: string // 예: "연남동"
  dongCode: string // population API용 8자리 코드 예: "11440710"
  fullName: string // 예: "서울 마포구 연남동"
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakaoMaps = (window as any).kakao?.maps

    if (!kakaoMaps?.services) {
      console.warn('[geocode] kakao.maps.services 미로드 — services 라이브러리를 확인하세요.')
      resolve(null)
      return
    }

    const geocoder = new kakaoMaps.services.Geocoder()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoder.coord2RegionCode(lng, lat, (result: any[], status: string) => {
      if (status !== kakaoMaps.services.Status.OK) {
        resolve(null)
        return
      }

      // region_type 'B' = 행정동, 'H' = 법정동
      // 화면 표시는 행정동(B) 기준을 유지하고, population API에는 법정동(H) 기반 8자리 코드를 사용한다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminRegion = result.find((r: any) => r.region_type === 'B') ?? result[0]
      const legalRegion = result.find((r: any) => r.region_type === 'H') ?? adminRegion

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
