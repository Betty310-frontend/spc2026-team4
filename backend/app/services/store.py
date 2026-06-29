"""소상공인시장진흥공단 공공 API 기반 경쟁업체·행정동 조회 서비스."""

import asyncio
import time

import httpx

from app.core.api_category import resolve_category_display
from app.core.category_map import CategoryFilter
from app.core.config import get_settings
from app.services import static_data as sd

_BASE_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius'
_TIMEOUT = 15.0
_PAGE_DELAY = 0.15  # 페이지 간 딜레이 (초) — rate limit 방지

# (lat, lng, radius) → (fetch_time, items) 단기 캐시 (60초 TTL)
# 한 요청 내 get_dong_codes_in_radius + search_competitors 중복 호출 방지
_FETCH_CACHE: dict[tuple, tuple[float, list[dict]]] = {}
_FETCH_CACHE_TTL = 60.0


def _api_key() -> str:
    return get_settings().public_data_api_key


def _cache_key(lat: float, lng: float, radius_m: int) -> tuple:
    return (round(lat, 5), round(lng, 5), radius_m)


async def _fetch_radius(
    lat: float,
    lng: float,
    radius_m: int,
    max_rows: int = 400,
) -> list[dict]:
    """반경 내 상가 목록을 소상공인공단 API로 페이징 조회한다.

    동일 (lat, lng, radius)는 60초간 메모리 캐시를 반환해
    한 분석 요청 내 중복 API 호출을 방지한다.
    """
    key = _cache_key(lat, lng, radius_m)
    now = time.monotonic()

    cached = _FETCH_CACHE.get(key)
    if cached:
        ts, items = cached
        if now - ts < _FETCH_CACHE_TTL:
            return items[:max_rows]

    results: list[dict] = []
    page = 1
    per_page = 100

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        while len(results) < max_rows:
            if page > 1:
                await asyncio.sleep(_PAGE_DELAY)

            resp = await client.get(
                _BASE_URL,
                params={
                    'serviceKey': _api_key(),
                    'pageNo': page,
                    'numOfRows': per_page,
                    'radius': radius_m,
                    'cx': lng,
                    'cy': lat,
                    'type': 'json',
                },
            )
            if resp.status_code == 429:
                # rate limit — 현재까지 수집한 것으로 중단
                break
            resp.raise_for_status()
            body = resp.json().get('body', {})
            items = body.get('items') or []
            if not items:
                break
            results.extend(items)
            total = body.get('totalCount', 0)
            if len(results) >= total or len(results) >= max_rows:
                break
            page += 1

    _FETCH_CACHE[key] = (now, results)
    return results


async def search_competitors(
    _session,
    lat: float,
    lng: float,
    radius_m: int,
    category_filter: CategoryFilter | None = None,
    limit: int = 200,
) -> list[dict]:
    """반경 내 경쟁 업소를 PostGIS ST_DWithin으로 조회한다."""
    point = WKTElement(f'POINT({lng} {lat})', srid=4326)

    cat_cond: ColumnElement[bool]
    same_display_name = category_filter.display_name if category_filter else ''

    if category_filter and category_filter.display_name:
        similar_names = get_similar_business_tags(category_filter.display_name)
        similar_filters = [get_category_filter(name) for name in similar_names]

        small_codes = tuple(
            code
            for item in similar_filters
            if item
            for code in item.small_codes
        )

        print("same_display_name =", same_display_name)
        print("similar_names =", similar_names)
        print("small_codes =", small_codes)

        if small_codes:
            cat_cond = Store.category_small_code.in_(small_codes)
        elif category_filter.small_codes:
            cat_cond = Store.category_small_code.in_(category_filter.small_codes)
        elif category_filter.large_code:
            cat_cond = Store.category_large_code == category_filter.large_code
        else:
            cat_cond = true()

    elif category_filter and category_filter.small_codes:
        cat_cond = Store.category_small_code.in_(category_filter.small_codes)
    elif category_filter and category_filter.large_code:
        cat_cond = Store.category_large_code == category_filter.large_code
    else:
        cat_cond = true()

    stmt = (
        select(
            Store.id,
            Store.name,
            Store.display_name,
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
            'type': 'same' if row.display_name == same_display_name else 'similar',
            'category': row.display_name,
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
    _session,
    lat: float,
    lng: float,
    radius_m: int,
) -> tuple[list[str], str | None]:
    """반경 내 행정동 코드 목록과 최다 업소 행정동명을 반환한다."""
    raw = await _fetch_radius(lat, lng, radius_m, max_rows=400)

    dong_count: dict[str, dict] = {}
    for item in raw:
        code = item.get('adongCd')
        name = item.get('adongNm')
        if code:
            if code not in dong_count:
                dong_count[code] = {'name': name, 'count': 0}
            dong_count[code]['count'] += 1

    if not dong_count:
        return [], None

    sorted_dongs = sorted(dong_count.items(), key=lambda x: -x[1]['count'])
    return [code for code, _ in sorted_dongs], sorted_dongs[0][1]['name']


def count_seoul_category(category_filter: CategoryFilter | None) -> int:
    """서울 전체 업종 수를 정적 CSV 데이터로 반환한다 (퍼센타일 기준값용).

    소분류 코드 앞 4자리 = 중분류 코드 (예: 'I21201' → 'I212').
    """
    if not category_filter:
        return 0
    data = sd.get()
    if category_filter.small_codes:
        seen_mid: set[str] = set()
        total = 0
        for sc in category_filter.small_codes:
            mid = sc[:4]
            if mid not in seen_mid:
                seen_mid.add(mid)
                total += data.store_by_mid.get(mid, 0)
        return total
    if category_filter.large_code:
        return data.store_by_major.get(category_filter.large_code, 0)
    return 0


def get_dong_name_by_code(dong_code: str) -> str | None:
    """행정동 코드로 행정동명을 반환한다 (메모리 룩업)."""
    return sd.get().dong_names.get(dong_code)
