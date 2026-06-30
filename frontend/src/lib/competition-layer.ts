'use client'

import { cellToBoundary, cellToLatLng } from 'h3-js'
import type { H3HexagonItem } from '@/types/api'

type LayerMountOptions = {
  onCountChange?: (count: number) => void
  onHexSelect?: (h3Index: string | null) => void
}

export interface CompetitionLayerManager {
  mount(map: kakao.maps.Map, options?: LayerMountOptions): void
  render(
    hexagons: H3HexagonItem[],
    options?: {
      center?: { lat: number; lng: number }
      radiusM?: number
      resolution?: number
      selectedHexIndex?: string | null
    },
  ): void
  clear(): void
  destroy(): void
}

const pathCache = new Map<string, kakao.maps.LatLng[]>()
const centerCache = new Map<string, kakao.maps.LatLng>()

function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function getHeatmapColor(count: number, maxCount: number): string | null {
  if (count <= 0 || maxCount <= 0) return null

  const ratio = clampRatio(count / maxCount)
  if (ratio > 0.7) return '#EF4444'
  if (ratio > 0.4) return '#F59E0B'
  if (ratio > 0.15) return '#FACC15'
  return '#10B981'
}

function getHexagonPath(h3Index: string): kakao.maps.LatLng[] {
  const cached = pathCache.get(h3Index)
  if (cached) return cached

  const boundary = cellToBoundary(h3Index, true)
  const path = boundary.map(([lng, lat]: [number, number]) => new window.kakao.maps.LatLng(lat, lng))

  if (path.length > 1) {
    const first = path[0]
    const last = path[path.length - 1]
    if (first.getLat() !== last.getLat() || first.getLng() !== last.getLng()) {
      path.push(first)
    }
  }

  pathCache.set(h3Index, path)
  return path
}

function getHexagonCenter(h3Index: string): kakao.maps.LatLng {
  const cached = centerCache.get(h3Index)
  if (cached) return cached

  const [lat, lng] = cellToLatLng(h3Index)
  const center = new window.kakao.maps.LatLng(lat, lng)
  centerCache.set(h3Index, center)
  return center
}

function getInteriorBufferMeters(resolution?: number): number {
  switch (resolution) {
    case 10:
      return 80
    case 9:
      return 150
    case 8:
      return 260
    case 7:
      return 450
    default:
      return 150
  }
}

function getDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadius = 6371000
  const toRadians = (value: number) => (value * Math.PI) / 180
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

export function createCompetitionLayerManager(): CompetitionLayerManager {
  let map: kakao.maps.Map | null = null
  let polygons: kakao.maps.Polygon[] = []
  let listeners: Array<{
    polygon: kakao.maps.Polygon
    onClick: () => void
  }> = []
  let onCountChange: ((count: number) => void) | undefined
  let onHexSelect: ((h3Index: string | null) => void) | undefined

  const detachPolygons = () => {
    for (const binding of listeners) {
      window.kakao.maps.event.removeListener(binding.polygon, 'click', binding.onClick)
    }
    listeners = []

    for (const polygon of polygons) {
      polygon.setMap(null)
    }

    polygons = []
    onCountChange?.(0)
  }

  const clear = () => {
    detachPolygons()
  }

  const render = (
    hexagons: H3HexagonItem[],
    options?: {
      center?: { lat: number; lng: number }
      radiusM?: number
      resolution?: number
      selectedHexIndex?: string | null
    },
  ) => {
    if (!map || !window.kakao?.maps) return

    detachPolygons()

    const center = options?.center ?? null
    const radiusM = options?.radiusM ?? null
    const resolution = options?.resolution
    const buffer = getInteriorBufferMeters(resolution)
    const selectedHexIndex = options?.selectedHexIndex ?? null

    const renderedCells = [...hexagons].filter((item) => {
      if (item.count > 0) return true
      if (!center || radiusM == null) return false

      const cellCenter = getHexagonCenter(item.h3Index)
      const distance = getDistanceMeters(center, {
        lat: cellCenter.getLat(),
        lng: cellCenter.getLng(),
      })

      return distance <= Math.max(0, radiusM - buffer)
    })

    if (!renderedCells.length) {
      onCountChange?.(0)
      return
    }

    const maxCount = Math.max(...renderedCells.map((item) => item.count))

    for (const item of renderedCells) {
      const isWhitespace = item.count <= 0
      const isSelected = selectedHexIndex === item.h3Index
      const strokeWeight = isSelected ? 3 : isWhitespace ? 2 : 1
      const fillOpacity = isSelected ? 0.48 : isWhitespace ? 0.4 : 0.34
      const strokeOpacity = isSelected ? 0.95 : isWhitespace ? 0.88 : 0.65
      const strokeStyle: kakao.maps.StrokeStyles = isWhitespace ? 'dash' : 'solid'
      const strokeColor = isWhitespace ? '#2563EB' : getHeatmapColor(item.count, maxCount)
      const fillColor = isWhitespace ? '#DBEAFE' : getHeatmapColor(item.count, maxCount)

      if (!strokeColor || !fillColor) continue

      const path = getHexagonPath(item.h3Index)
      const polygon = new window.kakao.maps.Polygon({
        map,
        path,
        strokeWeight,
        strokeColor,
        strokeOpacity,
        strokeStyle,
        fillColor,
        fillOpacity,
        zIndex: isSelected ? 90 : isWhitespace ? 70 : 60,
      })

      const onClick = () => {
        window.kakao.maps.event.preventMap()
        onHexSelect?.(item.h3Index)
      }

      window.kakao.maps.event.addListener(polygon, 'click', onClick)
      listeners.push({ polygon, onClick })

      polygons.push(polygon)
    }

    onCountChange?.(polygons.length)
  }

  return {
    mount(nextMap: kakao.maps.Map, options?: LayerMountOptions) {
      map = nextMap
      onCountChange = options?.onCountChange
      onHexSelect = options?.onHexSelect
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
