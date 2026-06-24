from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_db, get_redis_client
from app.services.analysis import run_market_analysis
from app.services.report import build_report

router = APIRouter()


@router.get('/report')
async def get_report(
    station: str = Query(..., alias='위치'),
    category: str = Query(..., alias='업종'),
    radius: int = Query(500, alias='반경', ge=100, le=1000),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> dict:
    """상권 분석 상세 리포트를 반환한다. 프론트에서 PDF 변환에 사용."""
    analysis = await run_market_analysis(
        db, redis, station, category, radius, lat=lat, lng=lng
    )
    return build_report(analysis)
