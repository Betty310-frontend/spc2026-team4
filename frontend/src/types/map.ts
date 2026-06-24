import { MapOptions } from './api'

export type { MapOptions }

export interface KakaoMapProps {
  options: MapOptions | null
  userLocation?: { lat: number; lng: number } | null
  isLoading?: boolean
}
