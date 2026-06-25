"""PostGIS 기반 경쟁업체·행정동 조회 서비스."""

from geoalchemy2 import WKTElement
from geoalchemy2.types import Geography
from sqlalchemy import ColumnElement, cast, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.category_map import CategoryFilter
from app.entities.store import Store


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
    if category_filter and category_filter.small_codes:
        cat_cond = Store.category_small_code.in_(category_filter.small_codes)
    elif category_filter and category_filter.large_code:
        cat_cond = Store.category_large_code == category_filter.large_code
    else:
        cat_cond = true()

    stmt = (
        select(
            Store.id,
            Store.name,
            Store.display_name,          # 변경
            Store.address,
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
            'category': row.display_name,   # 변경
            'address': row.address,
        }
        for row in rows
    ]


async def count_seoul_category(
    session: AsyncSession,
    category_filter: CategoryFilter | None,
) -> int:
    """서울 전체에서 해당 업종 수를 반환한다 (퍼센타일 기준값용)."""
    cat_cond: ColumnElement[bool]

    if category_filter and category_filter.small_codes:
        cat_cond = Store.category_small_code.in_(category_filter.small_codes)
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


async def get_dong_name_by_code(
    session: AsyncSession,
    dong_code: str,
) -> str | None:
    """행정동 코드로 행정동명을 반환한다."""
    stmt = (
        select(Store.dong_name)
        .where(Store.dong_code == dong_code, Store.dong_name.isnot(None))
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()
