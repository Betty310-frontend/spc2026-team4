'use client'

import { useState } from 'react'

export type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'

export interface GeoPosition {
  lat: number
  lng: number
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)

  const requestLocation = (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return Promise.resolve(null)
    }

    setStatus('loading')

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setStatus('granted')
          setPosition(geoPos)
          resolve(geoPos)
        },
        () => {
          setStatus('denied')
          resolve(null)
        },
        { timeout: 8000, maximumAge: 300000 },
      )
    })
  }

  return { status, position, requestLocation }
}
