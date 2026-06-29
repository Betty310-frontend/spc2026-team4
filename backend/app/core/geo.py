"""지리 참조 데이터 — 역명·동네명 → 좌표 매핑."""

import logging

import httpx
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

STATION_COORDS: dict[str, dict[str, float]] = {
    # 강남·서초
    '강남역': {'lat': 37.4979, 'lng': 127.0276},
    '역삼역': {'lat': 37.5006, 'lng': 127.0366},
    '선릉역': {'lat': 37.5045, 'lng': 127.0491},
    '선정릉역': {'lat': 37.5097, 'lng': 127.0468},
    '삼성역': {'lat': 37.5088, 'lng': 127.0633},
    '종합운동장역': {'lat': 37.5109, 'lng': 127.0730},
    '교대역': {'lat': 37.4937, 'lng': 127.0141},
    '방배역': {'lat': 37.4816, 'lng': 126.9977},
    # 마포·용산
    '홍대입구역': {'lat': 37.5574, 'lng': 126.9258},
    '합정역': {'lat': 37.5497, 'lng': 126.9147},
    '상수역': {'lat': 37.5477, 'lng': 126.9234},
    '연남동': {'lat': 37.5661, 'lng': 126.9229},
    '이태원역': {'lat': 37.5346, 'lng': 126.9946},
    '한남동': {'lat': 37.5376, 'lng': 127.0032},
    # 성동·광진
    '성수역': {'lat': 37.5446, 'lng': 127.0559},
    '건대입구역': {'lat': 37.5401, 'lng': 127.0699},
    '뚝섬역': {'lat': 37.5473, 'lng': 127.0448},
    # 노원·도봉
    '상계역': {'lat': 37.6565, 'lng': 127.0651},
    '노원역': {'lat': 37.6558, 'lng': 127.0565},
    # 양천·강서
    '목동': {'lat': 37.5272, 'lng': 126.8748},
    '발산역': {'lat': 37.5588, 'lng': 126.8374},
    # 종로·중구
    '종각역': {'lat': 37.5700, 'lng': 126.9820},
    '을지로입구역': {'lat': 37.5660, 'lng': 126.9826},
    '명동': {'lat': 37.5637, 'lng': 126.9825},
    '동대문역사문화공원역': {'lat': 37.5651, 'lng': 127.0096},
    # 송파·강동
    '잠실역': {'lat': 37.5131, 'lng': 127.1003},
    '천호역': {'lat': 37.5383, 'lng': 127.1237},
    # 동작·관악
    '사당역': {'lat': 37.4765, 'lng': 126.9815},
    '신림역': {'lat': 37.4847, 'lng': 126.9293},
}

DEFAULT_COORDS: dict[str, float] = {'lat': 37.5665, 'lng': 126.9780}

_GEO_CACHE_TTL = 60 * 60 * 24 * 7  # 7일


def resolve_coords(station: str) -> dict[str, float]:
    """역명 또는 동네명으로 좌표를 반환한다. 미등록 시 서울 중심 좌표."""
    return STATION_COORDS.get(station, DEFAULT_COORDS)


async def geocode_station(
    station: str,
    kakao_key: str,
    redis: Redis | None = None,
) -> dict[str, float]:
    """카카오 로컬 API로 역명·동네명을 좌표로 변환한다.

    조회 순서: 인메모리 사전 → Redis 캐시 → 카카오 API → 서울 중심 기본값
    """
    if station in STATION_COORDS:
        return STATION_COORDS[station]

    cache_key = f'geo:{station}'
    if redis:
        cached = await redis.get(cache_key)
        if cached:
            raw = cached.decode() if isinstance(cached, bytes) else cached
            lat, lng = raw.split(',')
            return {'lat': float(lat), 'lng': float(lng)}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # 역명이면 지하철역(SW8) 카테고리로 먼저 검색, 실패 시 키워드 전체 검색
            params: dict = {'query': station, 'size': 1}
            if station.endswith('역'):
                params['category_group_code'] = 'SW8'
            resp = await client.get(
                'https://dapi.kakao.com/v2/local/search/keyword.json',
                params=params,
                headers={'Authorization': f'KakaoAK {kakao_key}'},
            )
            resp.raise_for_status()
            docs = resp.json().get('documents', [])
            # SW8 검색 결과가 없으면 카테고리 제한 없이 재검색
            if not docs and params.get('category_group_code'):
                params.pop('category_group_code')
                resp = await client.get(
                    'https://dapi.kakao.com/v2/local/search/keyword.json',
                    params=params,
                    headers={'Authorization': f'KakaoAK {kakao_key}'},
                )
                resp.raise_for_status()
                docs = resp.json().get('documents', [])
            if docs:
                coords = {
                    'lat': float(docs[0]['y']),
                    'lng': float(docs[0]['x']),
                }
                if redis:
                    await redis.setex(
                        cache_key,
                        _GEO_CACHE_TTL,
                        f'{coords["lat"]},{coords["lng"]}',
                    )
                return coords
    except Exception as e:
        logger.warning(
            'Geocoding failed for %r: %s — falling back to DEFAULT_COORDS', station, e
        )

    return DEFAULT_COORDS
