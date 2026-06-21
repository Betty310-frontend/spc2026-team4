"""지리 참조 데이터 — 역명·동네명 → 좌표 매핑."""

STATION_COORDS: dict[str, dict[str, float]] = {
    '강남역': {'lat': 37.4979, 'lng': 127.0276},
    '선정릉역': {'lat': 37.5097, 'lng': 127.0468},
    '홍대입구역': {'lat': 37.5574, 'lng': 126.9258},
    '연남동': {'lat': 37.5661, 'lng': 126.9229},
    '성수역': {'lat': 37.5446, 'lng': 127.0559},
    '목동': {'lat': 37.5272, 'lng': 126.8748},
    '상계역': {'lat': 37.6565, 'lng': 127.0651},
}

DEFAULT_COORDS: dict[str, float] = {'lat': 37.5665, 'lng': 126.9780}


def resolve_coords(station: str) -> dict[str, float]:
    """역명 또는 동네명으로 좌표를 반환한다. 미등록 시 서울 중심 좌표."""
    return STATION_COORDS.get(station, DEFAULT_COORDS)
