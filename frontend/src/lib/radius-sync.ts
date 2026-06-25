'use client'

export function clampRadius(r: number): number {
  if (!Number.isFinite(r)) return 100
  return Math.max(100, Math.min(2000, Math.round(r)))
}

export function radiusToLevel(r: number): number {
  const radiusM = clampRadius(r)

  // 분석 반경보다 한 단계 더 줌인해서 보이도록 설정한다.
  // 예: 500m 분석 반경은 지도상에서 약 250m 체감으로 보이게 한다.
  if (radiusM <= 60) return 1
  if (radiusM <= 120) return 2
  if (radiusM <= 220) return 3
  if (radiusM <= 320) return 4
  if (radiusM <= 520) return 5
  if (radiusM <= 750) return 6
  if (radiusM <= 1100) return 7
  if (radiusM <= 1600) return 8
  return 9
}

export function makeContextHash(ctx: {
  category: string
  location: string
  radiusM: number
}): string {
  return `cat=${ctx.category}|loc=${ctx.location}|r=${ctx.radiusM}`
}
