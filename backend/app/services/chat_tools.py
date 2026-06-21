"""LangChain 도구 팩토리 — make_analysis_tools(db, redis)."""

import json

from langchain_core.tools import tool
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.category_map import CATEGORY_ICONS, get_category_filter
from app.core.geo import resolve_coords
from app.core.redis import encode_geohash
from app.services.report import build_report
from app.services.store import (
    calc_competition_percentile,
    count_seoul_category,
    search_competitors as _db_search_competitors,
)

_CACHE_TTL = 60 * 60 * 24  # 24h


def make_analysis_tools(db: AsyncSession, redis: Redis) -> list:
    """db/redis를 클로저로 캡처한 LangChain 도구 목록을 반환한다."""

    @tool
    async def search_competitors(station: str, category: str, radius: int = 500) -> dict:
        """반경 내 동일 업종 경쟁 업소를 조회하고 경쟁 밀집도를 계산합니다.

        Args:
            station: 지하철역 또는 동네명. 예: '연남동', '강남역', '홍대입구역', '성수역', '목동', '상계역'
            category: 업종명. 예: '카페', '음식점', '미용실', '학원', '편의점'
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        coords = resolve_coords(station)
        geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
        cache_key = f'market:{category}:{geohash_str}:{radius}'

        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        cat_filter = get_category_filter(category)
        competitors_raw = await _db_search_competitors(
            db, coords['lat'], coords['lng'], radius, cat_filter
        )
        seoul_total = await count_seoul_category(db, cat_filter)
        competitor_count = len(competitors_raw)
        competition_percentile = calc_competition_percentile(
            competitor_count, radius, seoul_total
        )

        result = {
            'station': station,
            'radius': radius,
            'category': category,
            'coords': coords,
            'metrics': {
                'competitor_count': competitor_count,
                'competition_percentile': competition_percentile,
                'population_flow_percentile': 0,
                'closure_rate_change': 0.0,
                'primary_demographic': '',
                'data_reference_month': '2025-12',
            },
            'competitors': [{**c, 'type': 'same'} for c in competitors_raw],
            'report': build_report(
                station, radius, category, competitor_count, competition_percentile
            ),
            'tags': [
                {'label': category, 'icon': CATEGORY_ICONS.get(category, '🏪')},
                {'label': station},
                {'label': f'반경 {radius}m'},
            ],
            'summary': (
                f'{station} 반경 {radius}m 내 {category}: '
                f'{competitor_count}개 영업 중, '
                f'경쟁 밀집도 서울 {competition_percentile}퍼센타일.'
            ),
        }

        await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
        return result

    return [search_competitors]
