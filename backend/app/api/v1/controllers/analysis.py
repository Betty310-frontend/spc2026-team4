import json

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_db, get_redis_client
from app.core.analysis_utils import build_h3_hexagons
from app.core.category_map import get_category_filter
from app.core.geo import resolve_coords
from app.core.redis import encode_geohash
from app.dto.analysis import H3HexagonItem
from app.services.store import search_competitors

router = APIRouter()

_CACHE_TTL = 60 * 60 * 24  # 24h


@router.get('/h3-hexagons')
async def get_h3_hexagons(
    station: str = Query(..., description='지하철역 또는 동네명. 예: 연남동, 강남역'),
    category: str = Query(..., description='업종명. 예: 카페, 음식점, 미용실'),
    radius: int = Query(500, ge=100, le=2000, description='분석 반경(미터)'),
    resolution: int = Query(8, ge=7, le=9, description='H3 해상도 (7~9)'),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> list[H3HexagonItem]:
    """반경 내 경쟁업체 위치를 H3 셀 단위로 집계해 반환합니다.

    프론트엔드 H3Map 컴포넌트에 전달할 `[{ h3Index, count }]` 형식으로 응답합니다.
    """
    cat_filter = get_category_filter(category)
    cache_category = cat_filter.display_name if cat_filter else category
    coords = resolve_coords(station)
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = f'h3hex:{cache_category}:{geohash_str}:{radius}:{resolution}'

    cached = await redis.get(cache_key)
    if cached:
        return [H3HexagonItem(**item) for item in json.loads(cached)]

    competitors = await search_competitors(
        db, coords['lat'], coords['lng'], radius, cat_filter
    )
    hexagons = build_h3_hexagons(competitors, resolution=resolution)

    await redis.setex(cache_key, _CACHE_TTL, json.dumps(hexagons, ensure_ascii=False))
    return [H3HexagonItem(**item) for item in hexagons]
