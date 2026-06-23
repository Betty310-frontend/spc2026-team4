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

export async function GET() {
  return NextResponse.json({
    total: 5,
    same_type: 3,
    similar_type: 2,
    data_source: '소상공인진흥공단',
    base_date: '2025-01',
    center: { lat: 37.5625, lng: 126.9252 },
    radius_m: 500,
    fallback: false,
    tier: 'high',
    percentile: 82,
    data: [
      {
        bizesId: 'MA0101',
        bizesNm: '연남로스터스',
        rdnmAdr: '서울 마포구 동교로 101',
        lat: 37.5631,
        lng: 126.9248,
        type: 'same',
      },
      {
        bizesId: 'MA0102',
        bizesNm: '카페모먼트',
        rdnmAdr: '서울 마포구 연남동 12',
        lat: 37.5617,
        lng: 126.9263,
        type: 'same',
      },
      {
        bizesId: 'MA0103',
        bizesNm: '연남커피랩',
        rdnmAdr: '서울 마포구 연희로 20',
        lat: 37.5609,
        lng: 126.9239,
        type: 'same',
      },
      {
        bizesId: 'MA0104',
        bizesNm: '연남디저트',
        rdnmAdr: '서울 마포구 동교로 55',
        lat: 37.5629,
        lng: 126.9271,
        type: 'similar',
      },
      {
        bizesId: 'MA0105',
        bizesNm: '베이크하우스',
        rdnmAdr: '서울 마포구 연남로 31',
        lat: 37.5642,
        lng: 126.9259,
        type: 'similar',
      },
    ],
  })
}
