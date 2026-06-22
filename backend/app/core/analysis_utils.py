"""경쟁 밀집도·H3 집계 — DB 의존 없는 순수 계산 함수."""

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


def build_h3_hexagons(
    competitors: list[dict],
    resolution: int = 8,
) -> list[dict]:
    """경쟁업체 좌표 목록을 H3 셀별 카운트로 집계한다."""
    counts: Counter[str] = Counter()
    for c in competitors:
        cell = h3.latlng_to_cell(c['lat'], c['lng'], resolution)
        counts[cell] += 1
    return [{'h3Index': cell, 'count': count} for cell, count in counts.items()]
