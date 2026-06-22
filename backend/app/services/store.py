"""PostGIS 기반 상가 조회 서비스."""

import math

from geoalchemy2 import WKTElement
from geoalchemy2.types import Geography
from sqlalchemy import ColumnElement, cast, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.category_map import CategoryFilter
from app.entities.local_people import LocalPeople
from app.entities.sales import SeoulSales
from app.entities.store import Store

# 서울 면적 (m²) — 경쟁 밀집도 퍼센타일 계산용
_SEOUL_AREA_M2 = 605_210_000


async def search_competitors(
    session: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
    category_filter: CategoryFilter | None = None,
    limit: int = 200,
) -> list[dict]:
    """반경 내 경쟁 업소를 PostGIS ST_DWithin으로 조회한다."""
    point = WKTElement(f'POINT({lng} {lat})', srid=4326)

    cat_cond: ColumnElement[bool]
    if category_filter and category_filter.mid_codes:
        cat_cond = Store.category_mid_code.in_(category_filter.mid_codes)
    elif category_filter and category_filter.large_code:
        cat_cond = Store.category_large_code == category_filter.large_code
    else:
        cat_cond = true()

    stmt = (
        select(
            Store.id,
            Store.name,
            Store.category_mid_name,
            func.ST_Y(Store.location).label('lat'),
            func.ST_X(Store.location).label('lng'),
        )
        .where(
            func.ST_DWithin(
                cast(Store.location, Geography),
                cast(point, Geography),
                radius_m,
            ),
            cat_cond,
        )
        .limit(limit)
    )

    rows = (await session.execute(stmt)).all()
    return [
        {
            'id': row.id,
            'name': row.name,
            'lat': float(row.lat),
            'lng': float(row.lng),
            'type': 'same',
        }
        for row in rows
    ]


async def count_seoul_category(
    session: AsyncSession,
    category_filter: CategoryFilter | None,
) -> int:
    """서울 전체에서 해당 업종 수를 반환한다 (퍼센타일 기준값용)."""
    cat_cond: ColumnElement[bool]
    if category_filter and category_filter.mid_codes:
        cat_cond = Store.category_mid_code.in_(category_filter.mid_codes)
    elif category_filter and category_filter.large_code:
        cat_cond = Store.category_large_code == category_filter.large_code
    else:
        cat_cond = true()

    stmt = select(func.count()).select_from(Store).where(cat_cond)
    return (await session.execute(stmt)).scalar_one()


async def get_dong_codes_in_radius(
    session: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
) -> tuple[list[str], str | None]:
    """반경 내 행정동 코드 목록과 최다 업소 행정동명을 반환한다."""
    point = WKTElement(f'POINT({lng} {lat})', srid=4326)
    stmt = (
        select(Store.dong_code, Store.dong_name, func.count().label('cnt'))
        .where(
            func.ST_DWithin(
                cast(Store.location, Geography),
                cast(point, Geography),
                radius_m,
            ),
            Store.dong_code.isnot(None),
        )
        .group_by(Store.dong_code, Store.dong_name)
        .order_by(func.count().desc())
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return [], None
    return [r.dong_code for r in rows], rows[0].dong_name


async def get_monthly_avg_sales(
    session: AsyncSession,
    dong_codes: list[str],
    sales_service_codes: tuple[str, ...],
) -> dict:
    """행정동 코드 목록 기준 월평균 추정매출을 반환한다."""
    if not dong_codes or not sales_service_codes:
        return {}

    # monthly_sales_amt는 분기 합계 — 월평균으로 변환하기 위해 ÷3
    stmt = select(
        (func.avg(SeoulSales.monthly_sales_amt) / 3).label('monthly_avg_amt'),
        (func.avg(SeoulSales.monthly_sales_cnt) / 3).label('monthly_avg_cnt'),
    ).where(
        SeoulSales.dong_code.in_(dong_codes),
        SeoulSales.service_code.in_(sales_service_codes),
    )
    row = (await session.execute(stmt)).one()
    return {
        'monthly_avg_sales_amt': int(row.monthly_avg_amt) if row.monthly_avg_amt else None,
        'monthly_avg_sales_cnt': int(row.monthly_avg_cnt) if row.monthly_avg_cnt else None,
    }


async def get_population_flow(
    session: AsyncSession,
    dong_codes: list[str],
    peak_hours: tuple[str, ...],
) -> dict:
    """행정동별 업종 핵심 시간대 평균 생활인구를 반환한다."""
    if not dong_codes or not peak_hours:
        return {}

    stmt = select(
        func.avg(LocalPeople.total).label('avg_pop'),
    ).where(
        LocalPeople.dong_code.in_(dong_codes),
        LocalPeople.time_slot.in_(peak_hours),
    )
    row = (await session.execute(stmt)).one()
    return {
        'avg_peak_population': round(float(row.avg_pop), 1) if row.avg_pop else None,
    }


def calc_competition_percentile(
    competitor_count: int,
    radius_m: int,
    seoul_total: int,
) -> int:
    """반경 내 업소 수를 서울 평균 밀도와 비교해 퍼센타일(0~100)로 반환한다.

    100에 가까울수록 경쟁이 높다는 의미.
    """
    circle_area = math.pi * radius_m ** 2
    expected = seoul_total * circle_area / _SEOUL_AREA_M2
    if expected <= 0:
        return 50
    ratio = competitor_count / expected
    # ratio=1 → 50퍼센타일, ratio=2 → ~75, ratio=0.5 → ~25
    percentile = int(50 * ratio)
    return max(0, min(100, percentile))
