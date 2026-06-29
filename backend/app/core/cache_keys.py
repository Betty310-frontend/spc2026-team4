"""Redis 캐시 키 구성 — 전 서비스가 공유하는 명명된 함수."""


def market_key(cache_category: str, geohash: str, radius: int) -> str:
    return f'market:v2:{cache_category}:{geohash}:{radius}'


def population_key(cache_category: str, geohash: str, radius: int) -> str:
    return f'pop:{cache_category}:{geohash}:{radius}'


def population_dong_key(
    dong_code: str, display_name: str, peak_hours: tuple[str, ...]
) -> str:
    return f'pop_dong:{dong_code}:{display_name}:{",".join(peak_hours)}'


def competition_key(cache_category: str, geohash: str, radius: int) -> str:
    return f'competile:{cache_category}:{geohash}:{radius}'


def h3_hexagons_key(
    cache_category: str, geohash: str, radius: int, resolution: int
) -> str:
    return f'h3hex:{cache_category}:{geohash}:{radius}:{resolution}'
