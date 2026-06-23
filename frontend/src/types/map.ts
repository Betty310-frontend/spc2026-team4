import { Competitor } from './api'

export interface MapOptions {
  center: { lat: number; lng: number }
  radius_m: number
  competitors: Competitor[]
}
