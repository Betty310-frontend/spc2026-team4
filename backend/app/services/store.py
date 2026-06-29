"""소상공인시장진흥공단 공공 API 기반 경쟁업체·행정동 조회 서비스."""

import asyncio
import time

import httpx

from app.core.api_category import resolve_category_display
from app.core.category_map import (
    CategoryFilter,
    get_category_filter,
    get_similar_business_tags,
)
from app.core.config import get_settings
from app.services import static_data as sd

_BASE_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius'
_TIMEOUT = 15.0
_PAGE_DELAY = 0.15

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
    """반경 내 상가 목록을 소상공인공단 API로 페이징 조회한다."""
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
    """반경 내 경쟁 업소를 공공 API로 조회한다."""
    raw = await _fetch_radius(lat, lng, radius_m, max_rows=400)

    same_display_name = category_filter.display_name if category_filter else ''
    similar_names = (
        get_similar_business_tags(same_display_name)
        if same_display_name
        else ()
    )
    similar_filters = [
        item
        for name in similar_names
        if (item := get_category_filter(name)) is not None
    ]
    small_codes = {
        code
        for item in similar_filters
        for code in item.small_codes
    }

    result: list[dict] = []

    for item in raw:
        small_code = item.get('indsSclsCd', '')
        large_code = item.get('indsLclsCd', '')

        if small_codes:
            if small_code not in small_codes:
                continue
        elif category_filter and category_filter.small_codes:
            if small_code not in category_filter.small_codes:
                continue
        elif category_filter and category_filter.large_code:
            if large_code != category_filter.large_code:
                continue

        try:
            lat_val = float(item.get('lat') or 0)
            lng_val = float(item.get('lon') or 0)
        except (TypeError, ValueError):
            continue

        display_name = resolve_category_display(
            small_code,
            item.get('indsMclsNm', ''),
        )

        result.append(
            {
                'id': item.get('bizesId', ''),
                'name': item.get('bizesNm', ''),
                'lat': lat_val,
                'lng': lng_val,
                'type': 'same' if display_name == same_display_name else 'similar',
                'category': display_name,
                'address': item.get('rdnmAdr', ''),
            }
        )

        if len(result) >= limit:
            break

    return result


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
    """서울 전체 업종 수를 정적 CSV 데이터로 반환한다."""
    if not category_filter:
        return 0

    data = sd.get()

    if category_filter.small_codes:
        seen_mid: set[str] = set()
        total = 0

        for small_code in category_filter.small_codes:
            mid_code = small_code[:4]

            if mid_code not in seen_mid:
                seen_mid.add(mid_code)
                total += data.store_by_mid.get(mid_code, 0)

        return total

    if category_filter.large_code:
        return data.store_by_major.get(category_filter.large_code, 0)

    return 0


def get_dong_name_by_code(dong_code: str) -> str | None:
    """행정동 코드로 행정동명을 반환한다."""
    return sd.get().dong_names.get(dong_code)