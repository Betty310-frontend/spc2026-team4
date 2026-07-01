"""LangChain 도구 팩토리 — make_analysis_tools(db, redis).

에이전트가 대화 맥락에 따라 아래 도구 중 필요한 것을 자동 선택한다.

  search_competitors          — 경쟁업체 현황 + 경쟁 밀집도 + 매출 종합 분석
  get_population_flow         — 핵심 시간대 생활인구 조회
  calc_competition_percentile — 경쟁 밀집도 퍼센타일만 빠르게 조회
  get_positioning_data        — 포지셔닝 맵용 경쟁업체 가격대·평점 (준비 중)
"""

import asyncio
from typing import Literal

from langchain_core.tools import tool
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.geo import geocode_station
from app.services.analysis import (
    run_competition_percentile,
    run_get_population,
    run_market_analysis,
)

CategoryType = Literal[
    '백반/한정식',
    '카페',
    '미용실',
    '입시·교과학원',
    '편의점',
    '김밥/만두/분식',
    '돼지고기 구이/찜',
    '요리 주점',
    '피부 관리실',
    '일식 회/초밥',
    '빵/도넛',
    '치킨',
    '네일숍',
    '요가/필라테스 학원',
    '국/탕/찌개류',
]

# 개별 도구 호출 타임아웃(초) — DB 또는 외부 API 응답 지연 시 hang 방지
_TOOL_TIMEOUT = 25


def make_analysis_tools(
    db: AsyncSession,
    redis: Redis,
    req_lat: float | None = None,
    req_lng: float | None = None,
) -> list:
    """db/redis를 클로저로 캡처한 LangChain 도구 목록을 반환한다."""

    _has_coords = req_lat is not None and req_lng is not None

    @tool
    async def search_competitors(
        station: str, category: CategoryType, radius: int = 500
    ) -> dict:
        """상권 종합 분석 — 경쟁업체·추정매출·생활인구를 한 번에 반환합니다.
        사용자가 업종·위치를 처음 언급하거나 변경할 때 반드시 이 도구를 먼저 호출합니다.
        핵심시간대·유동인구·매출·연령대·성별 질문이 섞여 있어도 이 도구 하나로 모두 해결됩니다.

        반환 데이터:
          - summary: 한 줄 요약 (경쟁업체 수, 밀집도, 매출, 인구)
          - metrics: competitor_count, competition_percentile 및 매출·인구 주요 지표
          - summarize: 긍정/위험 요인, 전략 제안
          (경쟁업체 전체 목록은 지도 패널에서 처리하므로 여기서는 수(count)만 포함)

        Args:
            station: 지하철역 또는 동네명. 예: '연남동', '강남역', '홍대입구역', '성수역'.
                     텍스트에서 위치를 파악할 수 없으면 빈 문자열을 전달해라.
            category: 업종명. 예: '카페', '음식점', '미용실', '학원', '편의점'
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        # 위치 없고 좌표도 없으면 도구 호출 불가
        if not station and not _has_coords:
            return {
                'error': 'location_required',
                'message': '분석할 위치를 알 수 없습니다. 역명이나 동네명을 알려주세요.',
            }

        # 좌표가 있으면 station 텍스트와 무관하게 좌표를 우선 사용한다.
        # station은 표시용 라벨로만 남기고, 재지오코딩은 하지 않는다.
        use_lat = req_lat if _has_coords else None
        use_lng = req_lng if _has_coords else None
        effective_station = station or '현재 위치'
        try:
            async with asyncio.timeout(_TOOL_TIMEOUT):
                full = await run_market_analysis(
                    db,
                    redis,
                    effective_station,
                    category,
                    radius,
                    lat=use_lat,
                    lng=use_lng,
                )
        except TimeoutError:
            return {
                'error': 'tool_timeout',
                'message': f'{effective_station} 데이터 조회 시간이 초과됐습니다. 반경을 줄이거나 잠시 후 다시 시도해주세요.',
            }
        if full.get('error') == 'geocode_failed':
            return {
                'error': 'geocode_failed',
                'message': full['message'],
            }
        m = full['metrics']
        all_competitors = full.get('competitors', [])
        top_competitors = [
            {
                'analysis_name': c['name'],
                'display_name': c['name'],
                'category': c.get('category', ''),
            }
            for c in all_competitors[:15]
        ]
        # 지도 시각화용: 좌표는 포함, 상호명은 마스킹
        competitors_for_map = [
            {
                'id': c.get('id'),
                'name': c['name'],
                'lat': c.get('lat'),
                'lng': c.get('lng'),
                'type': c.get('type', 'same'),
                'category': c.get('category', ''),
            }
            for c in all_competitors
        ]
        return {
            'summary': full.get('summary', ''),
            'station': full['station'],
            'category': full['category'],
            'radius_m': full['radius'],
            'radius': full['radius'],
            'dong_name': full.get('dong_name'),
            'coords': full.get('coords', {}),
            'competitors': competitors_for_map,
            'top_competitors': top_competitors,
            'tags': full.get('tags', []),
            'summarize': full.get('summarize', {}),
            'sources': full.get('sources', []),
            'scope': full.get('scope', {}),
            'metrics': {
                'competitor_count': m['competitor_count'],
                'same_count': m.get('same_count'),
                'similar_count': m.get('similar_count'),
                'competition_percentile': m['competition_percentile'],
                'monthly_avg_sales_amt': m.get('monthly_avg_sales_amt'),
                'monthly_avg_sales_cnt': m.get('monthly_avg_sales_cnt'),
                'per_store_est_amt': m.get('per_store_est_amt'),
                'per_store_est_cnt': m.get('per_store_est_cnt'),
                'weekday_avg_amt': m.get('weekday_avg_amt'),
                'weekend_avg_amt': m.get('weekend_avg_amt'),
                'male_avg_amt': m.get('male_avg_amt'),
                'female_avg_amt': m.get('female_avg_amt'),
                'sales_by_timeslot': m.get('sales_by_timeslot'),
                'peak_sales_slot': m.get('peak_sales_slot'),
                'sales_by_age': m.get('sales_by_age'),
                'top_sales_age': m.get('top_sales_age'),
                'avg_peak_population': m.get('avg_peak_population'),
                'peak_population_hour': m.get('peak_population_hour'),
                'hourly_population': m.get('hourly_population'),
                'male_pop_ratio': m.get('male_pop_ratio'),
                'female_pop_ratio': m.get('female_pop_ratio'),
                'population_by_age_ratio': m.get('population_by_age_ratio'),
                'top_population_age': m.get('top_population_age'),
            },
        }

    @tool
    async def get_population_flow(
        station: str, category: CategoryType, radius: int = 500
    ) -> dict:
        """생활인구 단독 조회 — search_competitors 이후 인구 흐름만 추가로 확인할 때 호출합니다.
        첫 분석이나 매출 데이터가 필요한 경우에는 search_competitors를 사용하세요.

        Args:
            station: 지하철역 또는 동네명. 텍스트에서 파악 불가 시 빈 문자열.
            category: 업종명 (핵심 시간대 산출에 사용). 예: '카페', '음식점', '미용실'
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        effective_station = station or '현재 위치'
        try:
            async with asyncio.timeout(_TOOL_TIMEOUT):
                return await run_get_population(
                    db,
                    redis,
                    effective_station,
                    category,
                    radius,
                    lat=req_lat if _has_coords else None,
                    lng=req_lng if _has_coords else None,
                )
        except TimeoutError:
            return {
                'error': 'tool_timeout',
                'message': f'{effective_station} 생활인구 조회 시간이 초과됐습니다.',
            }

    @tool
    async def calc_competition_percentile(
        station: str, category: CategoryType, radius: int = 500
    ) -> dict:
        """경쟁 밀집도 퍼센타일만 빠르게 조회합니다.
        "이 동네 경쟁 심한가요?" 처럼 밀집도 수치만 필요할 때 호출합니다.
        경쟁업체 조회만 수행하므로 search_competitors보다 빠릅니다.

        Args:
            station: 지하철역 또는 동네명.
            category: 업종명.
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        try:
            async with asyncio.timeout(_TOOL_TIMEOUT):
                coords = await geocode_station(
                    station, get_settings().kakao_rest_api_key, redis
                )
                if coords.get('geocode_failed'):
                    return {
                        'error': 'geocode_failed',
                        'message': f"'{station}' 위치를 찾을 수 없습니다.",
                    }
                result = await run_competition_percentile(
                    db, redis, coords['lat'], coords['lng'], category, radius
                )
        except TimeoutError:
            return {
                'error': 'tool_timeout',
                'message': f'{station} 밀집도 조회 시간이 초과됐습니다.',
            }
        percentile = result['percentile']
        return {
            'station': station,
            'category': category,
            'radius_m': radius,
            'competitor_count': result['competitor_count'],
            'competition_percentile': percentile,
            'percentile_label': result['label'],
        }

    @tool
    async def get_positioning_data(
        station: str, category: str, radius: int = 500
    ) -> dict:
        """반경 내 경쟁업체의 가격대·평점을 조회해 포지셔닝 맵 데이터를 반환합니다.
        경쟁업체 포지션 비교·차별화 전략을 묻거나 포지셔닝 맵을 요청할 때 호출합니다.

        Args:
            station: 지하철역 또는 동네명.
            category: 업종명.
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        return {
            'station': station,
            'category': category,
            'radius_m': radius,
            'available': False,
            'message': '포지셔닝 맵 데이터는 준비 중입니다. (카카오플레이스 연동 예정)',
        }

    return [
        search_competitors,
        get_population_flow,
        calc_competition_percentile,
        # get_positioning_data,  # 카카오플레이스 연동 완료 시 복원
    ]
