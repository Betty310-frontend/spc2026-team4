/**
 * [DEV ONLY] 목업 API — 서버 개발 완료 후 제거
 * 제거 범위는 competitors/route.ts 상단 주석 참고
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    percentile: 82,
    tier: 'high',
    label: '서울 상위 18%',
    same_business_count: 18,
    weighted_population: 32571,
    data_source: '소상공인진흥공단 + 서울생활인구',
    base_date: '2026-06',
    fallback: false,
    fallback_reason: null,
  })
}
