"""업종명 → DB 필터 조건 매핑 (소상공인공단 분류 코드 기준)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryFilter:
    mid_codes: tuple[str, ...] = ()
    large_code: str = ''
    display_name: str = ''
    sales_service_codes: tuple[str, ...] = ()
    peak_hours: tuple[str, ...] = ()  # 업종별 핵심 시간대 (생활인구 집계용)


# 카테고리명(소문자 정규화) → DB 필터
_MAP: dict[str, CategoryFilter] = {
    '카페':   CategoryFilter(mid_codes=('I212',), display_name='카페',   sales_service_codes=('CS100010',), peak_hours=tuple(f'{h:02d}' for h in range(11, 18))),
    '음식점': CategoryFilter(large_code='I2',     display_name='음식점', sales_service_codes=('CS100001', 'CS100002', 'CS100003', 'CS100004', 'CS100006', 'CS100007', 'CS100008'), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '한식':   CategoryFilter(mid_codes=('I201',), display_name='한식',   sales_service_codes=('CS100001',), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '중식':   CategoryFilter(mid_codes=('I202',), display_name='중식',   sales_service_codes=('CS100002',), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '일식':   CategoryFilter(mid_codes=('I203',), display_name='일식',   sales_service_codes=('CS100003',), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '양식':   CategoryFilter(mid_codes=('I204',), display_name='양식',   sales_service_codes=('CS100004',), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '미용실': CategoryFilter(mid_codes=('S207',), display_name='미용실', sales_service_codes=('CS200028',), peak_hours=tuple(f'{h:02d}' for h in range(10, 19))),
    '학원':   CategoryFilter(mid_codes=('P105', 'P106'), display_name='학원', sales_service_codes=('CS200001', 'CS200002', 'CS200003'), peak_hours=tuple(f'{h:02d}' for h in range(14, 21))),
    '편의점': CategoryFilter(mid_codes=('G205',), display_name='편의점', sales_service_codes=('CS300002',), peak_hours=tuple(f'{h:02d}' for h in range(7, 23))),
    '분식':   CategoryFilter(mid_codes=('I210',), display_name='분식',   sales_service_codes=('CS100008',), peak_hours=tuple(f'{h:02d}' for h in list(range(11, 14)) + list(range(17, 21)))),
    '치킨':   CategoryFilter(mid_codes=('I210',), display_name='치킨',   sales_service_codes=('CS100007',), peak_hours=tuple(f'{h:02d}' for h in range(17, 22))),
    '주점':   CategoryFilter(mid_codes=('I211',), display_name='주점',   sales_service_codes=('CS100009',), peak_hours=tuple(f'{h:02d}' for h in range(18, 24))),
    '제과점': CategoryFilter(mid_codes=('I210',), display_name='제과점', sales_service_codes=('CS100005',), peak_hours=tuple(f'{h:02d}' for h in range(9, 20))),
    '의원':   CategoryFilter(mid_codes=('Q102',), display_name='의원',   sales_service_codes=('CS200006',), peak_hours=tuple(f'{h:02d}' for h in range(9, 18))),
    '약국':   CategoryFilter(mid_codes=('G215',), display_name='약국',   sales_service_codes=('CS300018',), peak_hours=tuple(f'{h:02d}' for h in range(9, 21))),
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
    '분식집': '분식',
    '떡볶이': '분식',
    '치킨집': '치킨',
    '후라이드치킨': '치킨',
    '술집': '주점',
    '호프': '주점',
    '바': '주점',
    '베이커리': '제과점',
    '빵집': '제과점',
    '병원': '의원',
    '내과': '의원',
    '소아과': '의원',
    '피부과': '의원',
    '약국': '약국',
}


CATEGORY_ICONS: dict[str, str] = {
    '카페': '☕',
    '음식점': '🍽',
    '한식': '🍚',
    '중식': '🥢',
    '일식': '🍱',
    '양식': '🍝',
    '분식': '🍜',
    '치킨': '🍗',
    '주점': '🍺',
    '제과점': '🥐',
    '미용실': '✂️',
    '학원': '📚',
    '편의점': '🏪',
    '의원': '🏥',
    '약국': '💊',
}


def get_category_filter(name: str) -> CategoryFilter | None:
    key = _ALIASES.get(name, name)
    return _MAP.get(key)
