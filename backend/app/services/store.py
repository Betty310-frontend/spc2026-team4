"""geo_store DB 기반 경쟁업체·행정동 조회 서비스."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.api_category import resolve_category_display
from app.core.category_map import (
    CategoryFilter,
    get_category_filter,
    get_similar_business_tags,
)


async def search_competitors(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
    category_filter: CategoryFilter | None = None,
    limit: int = 200,
) -> list[dict]:
    """반경 내 경쟁 업소를 geo_store PostGIS 쿼리로 조회한다."""
    same_display_name = category_filter.display_name if category_filter else ''
    similar_names = (
        get_similar_business_tags(same_display_name) if same_display_name else ()
    )
    similar_filters: list[CategoryFilter] = [
        f for name in similar_names if (f := get_category_filter(name)) is not None
    ]

    all_small_codes: set[str] = set()
    if category_filter:
        all_small_codes.update(category_filter.small_codes)
    for sf in similar_filters:
        all_small_codes.update(sf.small_codes)

    if not all_small_codes:
        return []

    same_small_codes = set(category_filter.small_codes) if category_filter else set()

    result = await db.execute(
        text("""
            SELECT
                id,
                name,
                category_small_code,
                category_mid_name,
                display_name,
                address,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng
            FROM geo_store
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius_m
            )
            AND category_small_code = ANY(:small_codes)
            LIMIT :limit
        """),
        {
            'lat': lat,
            'lng': lng,
            'radius_m': radius_m,
            'small_codes': list(all_small_codes),
            'limit': limit,
        },
    )

    competitors: list[dict] = []
    for row in result:
        small_code = row.category_small_code or ''
        display = row.display_name or resolve_category_display(
            small_code, row.category_mid_name or ''
        )
        competitors.append(
            {
                'id': row.id,
                'name': row.name or '',
                'lat': float(row.lat) if row.lat is not None else 0.0,
                'lng': float(row.lng) if row.lng is not None else 0.0,
                'type': 'same' if small_code in same_small_codes else 'similar',
                'category': display,
                'address': row.address or '',
            }
        )

    return competitors


async def get_dong_codes_in_radius(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_m: int,
) -> tuple[list[str], str | None]:
    """반경 내 행정동 코드 목록과 최다 업소 행정동명을 반환한다."""
    result = await db.execute(
        text("""
            SELECT dong_code, dong_name, COUNT(*) AS cnt
            FROM geo_store
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius_m
            )
            AND dong_code IS NOT NULL
            GROUP BY dong_code, dong_name
            ORDER BY cnt DESC
        """),
        {'lat': lat, 'lng': lng, 'radius_m': radius_m},
    )
    rows = result.fetchall()
    if not rows:
        return [], None

    return [r.dong_code for r in rows], rows[0].dong_name


async def count_seoul_category(
    db: AsyncSession, category_filter: CategoryFilter | None
) -> int:
    """서울 전체 업종 수를 DB에서 반환한다."""
    if not category_filter:
        return 0

    if category_filter.small_codes:
        seen_mid: set[str] = set()
        total = 0
        for small_code in category_filter.small_codes:
            mid_code = small_code[:4]
            if mid_code not in seen_mid:
                seen_mid.add(mid_code)
                result = await db.execute(
                    text(
                        'SELECT SUM(store_count) AS cnt FROM store_count_by_middle WHERE middle_code = :code'
                    ),
                    {'code': mid_code},
                )
                row = result.one_or_none()
                if row and row.cnt:
                    total += int(row.cnt)
        return total

    if category_filter.large_code:
        result = await db.execute(
            text(
                'SELECT SUM(store_count) AS cnt FROM store_count_by_major WHERE major_code = :code'
            ),
            {'code': category_filter.large_code},
        )
        row = result.one_or_none()
        return int(row.cnt) if row and row.cnt else 0

    return 0


async def get_dong_name_by_code(db: AsyncSession, dong_code: str) -> str | None:
    """행정동 코드로 행정동명을 반환한다."""
    result = await db.execute(
        text('SELECT dong_name FROM dong_names WHERE dong_code = :code'),
        {'code': dong_code},
    )
    row = result.one_or_none()
    return row.dong_name if row else None
