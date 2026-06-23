/**
 * [DEV ONLY] 목업 API — 서버 개발 완료 후 제거
 * 제거 범위는 competitors/route.ts 상단 주석 참고
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    dong_code: '11440710',
    dong_name: '연남동',
    base_date: '2026-06',
    data_source: '서울 열린데이터 광장',
    weighted_avg: 32571,
    percentile: 77,
    time_range: '평일 11-17시',
    fallback: false,
  })
}
