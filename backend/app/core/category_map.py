"""업종명 → DB 필터 조건 매핑 (소상공인공단 분류 코드 기준)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryFilter:
    mid_codes: tuple[str, ...] = ()
    large_code: str = ''
    display_name: str = ''


# 카테고리명(소문자 정규화) → DB 필터
_MAP: dict[str, CategoryFilter] = {
    '카페': CategoryFilter(mid_codes=('I212',), display_name='카페'),
    '음식점': CategoryFilter(large_code='I2', display_name='음식점'),
    '한식': CategoryFilter(mid_codes=('I201',), display_name='한식'),
    '중식': CategoryFilter(mid_codes=('I202',), display_name='중식'),
    '일식': CategoryFilter(mid_codes=('I203',), display_name='일식'),
    '양식': CategoryFilter(mid_codes=('I204',), display_name='양식'),
    '미용실': CategoryFilter(mid_codes=('S207',), display_name='미용실'),
    '학원': CategoryFilter(mid_codes=('P105', 'P106'), display_name='학원'),
    '편의점': CategoryFilter(mid_codes=('G205',), display_name='편의점'),
}

# 별칭 처리
_ALIASES: dict[str, str] = {
    '커피숍': '카페',
    '커피': '카페',
    '카페테리아': '카페',
    '식당': '음식점',
    '밥집': '음식점',
    '헤어샵': '미용실',
    '헤어': '미용실',
    '미용': '미용실',
    '이용원': '미용실',
    '교육': '학원',
}


CATEGORY_ICONS: dict[str, str] = {
    '카페': '☕',
    '음식점': '🍽',
    '미용실': '✂️',
    '학원': '📚',
    '편의점': '🏪',
}


def get_category_filter(name: str) -> CategoryFilter | None:
    key = _ALIASES.get(name, name)
    return _MAP.get(key)
