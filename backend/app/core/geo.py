"""지리 참조 데이터 — 역명·동네명 → 좌표 매핑."""

import logging

import httpx
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

_GEO_CACHE_TTL = 60 * 60 * 24 * 7  # 7일

# 키워드 검색 결과에서 상권 분석에 부적합한 카테고리 prefix
_BAD_CATEGORY_PREFIXES = (
    '여행 > 관광,명소 > 산',
    '여행 > 도보여행',
    '여행 > 관광,명소 > 자연환경',
    '여행 > 관광,명소 > 공원',
)


async def _sw8_search(
    client: httpx.AsyncClient, query: str, kakao_key: str
) -> dict | None:
    """지하철역(SW8) 카테고리로 키워드 검색. 결과 없으면 None."""
    resp = await client.get(
        'https://dapi.kakao.com/v2/local/search/keyword.json',
        params={'query': query, 'size': 1, 'category_group_code': 'SW8'},
        headers={'Authorization': f'KakaoAK {kakao_key}'},
    )
    resp.raise_for_status()
    docs = resp.json().get('documents', [])
    if docs:
        return {'lat': float(docs[0]['y']), 'lng': float(docs[0]['x'])}
    return None


async def _address_search(
    client: httpx.AsyncClient, query: str, kakao_key: str
) -> dict | None:
    """주소/지역 검색 API. 구·동 이름을 정확한 행정구역 좌표로 변환. 서울 주소만 반환."""
    resp = await client.get(
        'https://dapi.kakao.com/v2/local/search/address.json',
        params={'query': query, 'size': 5},
        headers={'Authorization': f'KakaoAK {kakao_key}'},
    )
    resp.raise_for_status()
    for doc in resp.json().get('documents', []):
        addr = doc.get('address_name', '') or doc.get('road_address_name', '')
        if addr.startswith('서울'):
            return {'lat': float(doc['y']), 'lng': float(doc['x'])}
    return None


async def _keyword_seoul_search(
    client: httpx.AsyncClient, query: str, kakao_key: str
) -> dict | None:
    """키워드 검색 후 서울 주소 + 상권 적합 카테고리인 결과만 반환. 없으면 None."""
    resp = await client.get(
        'https://dapi.kakao.com/v2/local/search/keyword.json',
        params={'query': query, 'size': 5},
        headers={'Authorization': f'KakaoAK {kakao_key}'},
    )
    resp.raise_for_status()
    for doc in resp.json().get('documents', []):
        addr = doc.get('address_name', '')
        category = doc.get('category_name', '')
        if addr.startswith('서울') and not any(
            category.startswith(p) for p in _BAD_CATEGORY_PREFIXES
        ):
            return {'lat': float(doc['y']), 'lng': float(doc['x'])}
    return None


async def geocode_station(
    station: str,
    kakao_key: str,
    redis: Redis | None = None,
) -> dict[str, float]:
    """역명·동네명·구명을 서울 좌표로 변환한다.

    조회 순서:
      1. Redis 캐시
      2. 역명(~역) → SW8 지하철역 검색
      3. {입력}역 → SW8 지하철역 검색 (예: 남태령 → 남태령역)
      4. 주소 API → 구·동 행정구역 검색 (예: 관악 → 관악구)
      5. 키워드 검색 (서울 주소 + 상권 적합 카테고리 필터)
      6. 전부 실패 → geocode_failed
    """
    cache_key = f'geo:{station}'
    if redis:
        cached = await redis.get(cache_key)
        if cached:
            raw = cached.decode() if isinstance(cached, bytes) else cached
            lat, lng = raw.split(',')
            return {'lat': float(lat), 'lng': float(lng)}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            coords: dict | None = None

            # 1. 역 suffix → SW8
            if station.endswith('역'):
                coords = await _sw8_search(client, station, kakao_key)

            # 2. {입력}역 → SW8 (남태령 → 남태령역)
            if not coords and not station.endswith('역'):
                coords = await _sw8_search(client, station + '역', kakao_key)

            # 3. 주소 API → 구·동 행정구역
            if not coords:
                coords = await _address_search(client, station, kakao_key)

            # 4. 키워드 검색 (서울 + 상권 적합 카테고리)
            if not coords:
                coords = await _keyword_seoul_search(client, station, kakao_key)

            if coords:
                if redis:
                    await redis.setex(
                        cache_key,
                        _GEO_CACHE_TTL,
                        f'{coords["lat"]},{coords["lng"]}',
                    )
                return coords

    except Exception as e:
        logger.warning('Geocoding failed for %r: %s', station, e)

    logger.warning('Geocoding found no result for %r', station)
    return {'geocode_failed': True}
