'use client'

import { cellToBoundary, cellToLatLng } from 'h3-js'
import type { CenterCoords, CompetitionSurfaceItem } from '@/types/api'

type LayerMountOptions = {
  onCountChange?: (count: number) => void
}

export interface CompetitionLayerManager {
  mount(map: kakao.maps.Map, options?: LayerMountOptions): void
  render(surface: CompetitionSurfaceItem[], center: CenterCoords, radiusM: number): void
  clear(): void
  destroy(): void
}

const boundaryCache = new Map<string, kakao.maps.LatLng[]>()

function clampPercentile(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function getColorForPercentile(percentile: number): string {
  const p = clampPercentile(percentile)
  if (p < 20) return '#E6F1FB'
  if (p < 40) return '#B9D7F6'
  if (p < 60) return '#6FA9E8'
  if (p < 80) return '#378ADD'
  return '#A32D2D'
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function getDistanceMeters(a: CenterCoords, b: CenterCoords): number {
  const earthRadius = 6371000
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

function inRadius(cellCenter: CenterCoords, mapCenter: CenterCoords, radiusM: number): boolean {
  return getDistanceMeters(cellCenter, mapCenter) <= radiusM
}

function toLatLngPath(h3Index: string): kakao.maps.LatLng[] {
  const cached = boundaryCache.get(h3Index)
  if (cached) return cached

  const boundary = cellToBoundary(h3Index)
  const path = boundary.map(([lat, lng]) => new window.kakao.maps.LatLng(lat, lng))

  if (path.length > 0) {
    const first = path[0]
    const last = path[path.length - 1]
    if (first.getLat() !== last.getLat() || first.getLng() !== last.getLng()) {
      path.push(first)
    }
  }

  boundaryCache.set(h3Index, path)
  return path
}

function getCellCenter(h3Index: string): CenterCoords {
  const [lat, lng] = cellToLatLng(h3Index)
  return { lat, lng }
}

export function createCompetitionLayerManager(): CompetitionLayerManager {
  let map: kakao.maps.Map | null = null
  let polygons: kakao.maps.Polygon[] = []
  let renderGeneration = 0
  let onCountChange: ((count: number) => void) | undefined

  const detachPolygons = () => {
    for (const polygon of polygons) {
      polygon.setMap(null)
    }
    polygons = []
    onCountChange?.(0)
  }

  const clear = () => {
    renderGeneration += 1
    detachPolygons()
  }

  const render = (
    surface: CompetitionSurfaceItem[],
    center: CenterCoords,
    radiusM: number,
  ) => {
    if (!map || !window.kakao?.maps) {
      return
    }

    const generation = renderGeneration + 1
    renderGeneration = generation
    detachPolygons()

    const sorted = [...surface]
      .sort((a, b) => (b.p ?? 0) - (a.p ?? 0))
      .slice(0, 300)

    let index = 0
    const batchSize = 60

    const drawBatch = () => {
      if (generation !== renderGeneration || !map) return

      const end = Math.min(index + batchSize, sorted.length)
      for (let i = index; i < end; i += 1) {
        const item = sorted[i]
        const path = toLatLngPath(item.h3)
        const cellCenter = getCellCenter(item.h3)
        const polygon = new window.kakao.maps.Polygon({
          path,
          strokeWeight: 1.2,
          strokeColor: getColorForPercentile(item.p ?? 0),
          strokeOpacity: 0.7,
          strokeStyle: 'solid',
          fillColor: getColorForPercentile(item.p ?? 0),
          fillOpacity: inRadius(cellCenter, center, radiusM) ? 0.42 : 0.24,
          zIndex: 50,
        })

        polygon.setMap(map)
        polygons.push(polygon)
      }

      index = end
      onCountChange?.(polygons.length)

      if (index < sorted.length) {
        requestAnimationFrame(drawBatch)
      }
    }

    requestAnimationFrame(drawBatch)
  }

  return {
    mount(nextMap: kakao.maps.Map, options?: LayerMountOptions) {
      map = nextMap
      onCountChange = options?.onCountChange
    },
    render,
    clear,
    destroy() {
      clear()
      map = null
      onCountChange = undefined
    },
  }
}
