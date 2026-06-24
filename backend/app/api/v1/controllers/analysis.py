import json

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_db, get_redis_client
from app.core.analysis_utils import build_h3_hexagons
from app.core.category_map import get_category_filter
from app.core.geo import resolve_coords
from app.core.redis import encode_geohash
from app.dto.analysis import (
    CenterCoords,
    CompetitionPercentileResponse,
    CompetitorItem,
    CompetitorsResponse,
    H3HexagonItem,
    PopulationHourItem,
    PopulationResponse,
)
from app.services.analysis import (
    run_competition_percentile,
    run_get_population_by_dong,
    run_market_analysis,
)
from app.services.store import search_competitors

router = APIRouter()

_CACHE_TTL = 60 * 60 * 24


@router.get('/competitors')
async def get_competitors(
    location: str = Query(..., alias='위치', examples=['연남동']),
    category: str = Query(..., alias='업종', examples=['카페']),
    radius: int = Query(500, alias='반경', ge=100, le=1000, examples=[500]),
    lat: float | None = Query(None, examples=[37.5611]),
    lng: float | None = Query(None, examples=[126.9231]),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> CompetitorsResponse:
    result = await run_market_analysis(
        db, redis, location, category, radius, lat=lat, lng=lng
    )
    competitors = result['competitors']
    same = [c for c in competitors if c.get('type') == 'same']
    similar = [c for c in competitors if c.get('type') == 'similar']
    return CompetitorsResponse(
        total=len(competitors),
        same_type=len(same),
        similar_type=len(similar),
        data_source='소상공인시장진흥공단',
        base_date='2026-03',
        center=CenterCoords(**result['coords']),
        radius_m=radius,
        fallback=False,
        data=[CompetitorItem(**c) for c in competitors],
    )


@router.get('/population')
async def get_population(
    dong_code: str = Query(..., alias='행정동코드', examples=['1141011600']),
    category: str = Query(..., alias='업종', examples=['카페']),
    time_slots: list[str] = Query(
        default=[], alias='시간대', examples=['11-14', '14-17']
    ),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> PopulationResponse:
    result = await run_get_population_by_dong(
        db, redis, dong_code, category, time_slots or None
    )
    return PopulationResponse(
        dong_code=result['dong_code'],
        dong_name=result['dong_name'],
        base_date=result['base_date'],
        data_source=result['data_source'],
        weighted_avg=result['weighted_avg'],
        percentile=result['percentile'],
        time_weights_applied=result['time_weights_applied'],
        fallback=result['fallback'],
        fallback_reason=result.get('fallback_reason'),
        data=[PopulationHourItem(**item) for item in result['data']],
    )


@router.get('/competition-percentile')
async def get_competition_percentile(
    lat: float = Query(..., examples=[37.5611]),
    lng: float = Query(..., examples=[126.9231]),
    category: str = Query(..., alias='업종', examples=['카페']),
    radius: int = Query(500, alias='반경', ge=100, le=1000, examples=[500]),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> CompetitionPercentileResponse:
    result = await run_competition_percentile(db, redis, lat, lng, category, radius)
    return CompetitionPercentileResponse(**result)


@router.get('/h3-hexagons')
async def get_h3_hexagons(
    station: str = Query(..., examples=['연남동']),
    category: str = Query(..., examples=['카페']),
    radius: int = Query(500, ge=100, le=2000, examples=[500]),
    resolution: int = Query(8, ge=7, le=9, examples=[8]),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> list[H3HexagonItem]:
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
