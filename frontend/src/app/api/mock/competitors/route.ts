/**
 * [DEV ONLY] 목업 API — 서버 개발 완료 후 제거
 *
 * 제거 조건:
 *   1. FastAPI /api/v1/competitors 엔드포인트 연동 완료
 *   2. FastAPI /api/v1/population 엔드포인트 연동 완료
 *   3. FastAPI /api/v1/competition-percentile 엔드포인트 연동 완료
 *
 * 제거 범위:
 *   - app/api/mock/competitors/route.ts       ← 이 파일
 *   - app/api/mock/population/route.ts
 *   - app/api/mock/competition-percentile/route.ts
 *   - hooks/use-mock-analysis.ts
 *   - app/page.tsx 의 [DEV] 테스트 버튼
 */

import { NextResponse } from 'next/server'

const CENTER = { lat: 37.5625, lng: 126.9252 }
const RADIUS_DEG = 0.004 // ~500m

// 재현 가능한 의사난수 — Math.random() 대신 시드 기반 사용
function seededRand(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function makeCompetitor(i: number) {
  const angle = seededRand(i * 7) * 2 * Math.PI
  const r = seededRand(i * 13) * RADIUS_DEG
  const isSimilar = i % 3 === 0
  return {
    bizesId: `MA${String(i).padStart(4, '0')}`,
    bizesNm: isSimilar ? `베이크하우스${i}` : `카페테스트${i}`,
    rdnmAdr: `서울 마포구 연남동 ${i}`,
    lat: CENTER.lat + r * Math.sin(angle),
    lng: CENTER.lng + r * Math.cos(angle),
    type: isSimilar ? ('similar' as const) : ('same' as const),
    indsLclsNm: '음식',
    indsMclsNm: isSimilar ? '제과제빵' : '카페',
    indsSclsNm: isSimilar ? '제과점' : '커피전문점',
  }
}

export async function GET(req: Request) {
  // ?count=N 으로 개수 지정 (기본 5, 클러스터 테스트 시 50 이상)
  const url = new URL(req.url)
  const count = Math.max(1, Math.min(200, Number(url.searchParams.get('count') ?? '5')))

  const data = Array.from({ length: count }, (_, i) => makeCompetitor(i + 1))
  const sameCount = data.filter((d) => d.type === 'same').length

  return NextResponse.json({
    total: count,
    same_type: sameCount,
    similar_type: count - sameCount,
    data_source: '소상공인진흥공단',
    base_date: '2025-01',
    center: CENTER,
    radius_m: 500,
    fallback: false,
    tier: 'high',
    percentile: 82,
    data,
  })
}
