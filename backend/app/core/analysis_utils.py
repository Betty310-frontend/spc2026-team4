"""경쟁 밀집도·H3 집계·퍼센타일 — DB 의존 없는 순수 계산 함수."""

import math
from collections import Counter

import h3

# 서울 면적 (m²) — 경쟁 밀집도 퍼센타일 계산용
_SEOUL_AREA_M2 = 605_210_000


def calc_competition_percentile(
    competitor_count: int,
    radius_m: int,
    seoul_total: int,
) -> int:
    """반경 내 업소 수를 서울 평균 밀도와 비교해 퍼센타일(0~100)로 반환한다.

    100에 가까울수록 경쟁이 높다는 의미.
    """
    circle_area = math.pi * radius_m**2
    expected = seoul_total * circle_area / _SEOUL_AREA_M2
    if expected <= 0:
        return 50
    ratio = competitor_count / expected
    percentile = int(50 * ratio)
    return max(0, min(100, percentile))


def calc_percentile(value: float, reference_values: list[float]) -> int:
    """기준값 목록 대비 퍼센타일(0~100)을 반환한다. 빈 목록이면 50을 반환."""
    if not reference_values:
        return 50
    rank = sum(1 for v in reference_values if v < value)
    return round(rank / len(reference_values) * 100)


def build_h3_hexagons(
    competitors: list[dict],
    center_lat: float,
    center_lng: float,
    radius_m: int,
    resolution: int = 9,
) -> list[dict]:
    """반경 내 전체 H3 셀을 생성하고 경쟁업체 수로 채운다.

    빈 셀(count=0)도 포함해 항상 일정 수의 헥사곤을 반환한다.
    커버리지 반경은 radius_m × 2로 확장해 지도 절반 정도를 채운다.
    """
    coverage_m = max(700, min(radius_m * 2, 1200))
    deg_per_m_lat = 1 / 111320
    deg_per_m_lng = 1 / (111320 * math.cos(math.radians(center_lat)))
    n = 64
    ring = [
        [
            center_lng + coverage_m * deg_per_m_lng * math.sin(2 * math.pi * i / n),
            center_lat + coverage_m * deg_per_m_lat * math.cos(2 * math.pi * i / n),
        ]
        for i in range(n)
    ]
    ring.append(ring[0])
    all_cells: set[str] = h3.geo_to_cells(
        {'type': 'Polygon', 'coordinates': [ring]}, resolution
    )

    counts: Counter[str] = Counter()
    for c in competitors:
        cell = h3.latlng_to_cell(c['lat'], c['lng'], resolution)
        counts[cell] += 1

    return [{'h3Index': cell, 'count': counts.get(cell, 0)} for cell in all_cells]
