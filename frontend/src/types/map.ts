import { H3HexagonItem, MapOptions } from './api'

export type { MapOptions }

export interface KakaoMapProps {
  options: MapOptions | null
  h3Hexagons?: H3HexagonItem[]
  userLocation?: { lat: number; lng: number } | null
  isLoading?: boolean
  isActive?: boolean
}
