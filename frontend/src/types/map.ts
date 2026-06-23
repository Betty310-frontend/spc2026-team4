import { Competitor } from './api'

export interface MapOptions {
  center: { lat: number; lng: number }
  radius_m: number
  competitors: Competitor[]
}

export interface KakaoMapProps {
  options: MapOptions | null
  userLocation?: { lat: number; lng: number } | null
  isLoading?: boolean
}
