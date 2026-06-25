"""업종명 → DB 필터 조건 매핑 (소상공인공단 분류 코드 기준)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryFilter:
    small_codes: tuple[str, ...] = ()
    large_code: str = ''
    display_name: str = ''
    sales_service_codes: tuple[str, ...] = ()
    # peak_hours: tuple[str, ...] = ()  # 업종별 핵심 시간대 (생활인구 집계용)


# 카테고리명(Supabase display_name) → DB 필터
_MAP: dict[str, CategoryFilter] = {
    '한식': CategoryFilter(
        small_codes=('I20101', 'I20102'),
        display_name='한식',
        sales_service_codes=('CS100001',),
    ),
    '카페': CategoryFilter(
        small_codes=('I21201',),
        display_name='카페',
        sales_service_codes=('CS100010',),
    ),
    '미용실': CategoryFilter(
        small_codes=('S20701',),
        display_name='미용실',
        sales_service_codes=('CS200028',),
    ),
    '입시학원': CategoryFilter(
        small_codes=('P10501',),
        display_name='입시학원',
        sales_service_codes=('CS200001', 'CS200002'),
    ),
    '편의점': CategoryFilter(
        small_codes=('G20405',),
        display_name='편의점',
        sales_service_codes=('CS300002',),
    ),
    '분식': CategoryFilter(
        small_codes=('I21007',),
        display_name='분식',
        sales_service_codes=('CS100008',),
    ),
    '고깃집': CategoryFilter(
        small_codes=('I20107',),
        display_name='고깃집',
        sales_service_codes=('CS100001',),
    ),
    '요리주점': CategoryFilter(
        small_codes=('I21104',),
        display_name='요리주점',
        sales_service_codes=('CS100009',),
    ),
    '피부관리': CategoryFilter(
        small_codes=('S20702',),
        display_name='피부관리',
        sales_service_codes=('CS200028',),
    ),
    '일식': CategoryFilter(
        small_codes=('I20301',),
        display_name='일식',
        sales_service_codes=('CS100003',),
    ),
    '베이커리': CategoryFilter(
        small_codes=('I21001',),
        display_name='베이커리',
        sales_service_codes=('CS100005',),
    ),
    '치킨': CategoryFilter(
        small_codes=('I21006',),
        display_name='치킨',
        sales_service_codes=('CS100007',),
    ),
    '네일샵': CategoryFilter(
        small_codes=('S20703',),
        display_name='네일샵',
        sales_service_codes=('CS200028',),
    ),
    '요가필라테스': CategoryFilter(
        small_codes=('P10603',),
        display_name='요가필라테스',
        sales_service_codes=('CS200003',),
    ),
}

# 자연어 입력 → Supabase display_name
_ALIASES: dict[str, str] = {
    # 카페
    '커피': '카페',
    '커피숍': '카페',
    '카페테리아': '카페',
    '디저트': '카페',
    '디저트카페': '카페',
    '빵집': '베이커리',
    '베이커리': '베이커리',

    # 음식
    '음식점': '한식',
    '식당': '한식',
    '밥집': '한식',
    '한식집': '한식',
    '분식집': '분식',
    '김밥': '분식',
    '만두': '분식',
    '고기집': '고깃집',
    '돼지고기': '고깃집',
    '술집': '요리주점',
    '주점': '요리주점',
    '일식집': '일식',
    '초밥': '일식',
    '회': '일식',
    '치킨집': '치킨',

    # 미용
    '헤어': '미용실',
    '헤어샵': '미용실',
    '뷰티': '미용실',
    '피부': '피부관리',
    '네일': '네일샵',

    # 학원
    '교육': '입시학원',
    '공부': '입시학원',
    '입시': '입시학원',
    '교과학원': '입시학원',
    '요가': '요가필라테스',
    '필라테스': '요가필라테스',
    '요가학원': '요가필라테스',
    '필라테스학원': '요가필라테스',
}

# 자연어 입력 → 대표 업종 그룹
_GROUP_ALIASES: dict[str, str] = {
    '카페': '카페',
    '커피': '카페',
    '커피숍': '카페',
    '디저트': '카페',

    '음식': '음식',
    '음식점': '음식',
    '식당': '음식',
    '밥집': '음식',
    '한식': '음식',
    '분식': '음식',
    '고깃집': '음식',
    '고기집': '음식',
    '요리주점': '음식',
    '술집': '음식',
    '일식': '음식',
    '초밥': '음식',
    '치킨': '음식',

    '미용': '미용',
    '뷰티': '미용',
    '미용실': '미용',
    '피부': '미용',
    '피부관리': '미용',
    '네일': '미용',
    '네일샵': '미용',

    '학원': '학원',
    '교육': '학원',
    '공부': '학원',
    '입시': '학원',
    '입시학원': '학원',
    '요가': '학원',
    '필라테스': '학원',
    '요가필라테스': '학원',
}


CATEGORY_ICONS: dict[str, str] = {
    '한식': '🍚',
    '카페': '☕',
    '미용실': '✂️',
    '입시학원': '📚',
    '편의점': '🏪',
    '분식': '🍜',
    '고깃집': '🥩',
    '요리주점': '🍺',
    '피부관리': '💆',
    '일식': '🍱',
    '베이커리': '🥐',
    '치킨': '🍗',
    '네일샵': '💅',
    '요가필라테스': '🧘',
}

# 대표 업종 → 유사 display_name 목록
SIMILAR_BUSINESS_TAGS: dict[str, tuple[str, ...]] = {
    '카페': ('카페', '베이커리'),
    '음식': ('한식', '분식', '고깃집', '요리주점', '일식', '치킨'),
    '미용': ('미용실', '피부관리', '네일샵'),
    '학원': ('입시학원', '요가필라테스'),
}


def normalize_category_name(name: str) -> str:
    """자연어 업종명을 Supabase display_name 기준으로 정규화한다."""
    key = name.strip()
    return _ALIASES.get(key, key)


def normalize_group_name(name: str) -> str:
    """자연어 업종명을 대표 업종 그룹 기준으로 정규화한다."""
    key = name.strip()
    return _GROUP_ALIASES.get(key, key)


def get_category_filter(name: str) -> CategoryFilter | None:
    key = normalize_category_name(name)
    return _MAP.get(key)


def get_similar_business_tags(name: str) -> tuple[str, ...]:
    """자연어 업종명을 대표 업종 기준 유사 display_name 목록으로 변환한다."""
    group = normalize_group_name(name)

    if group in SIMILAR_BUSINESS_TAGS:
        return SIMILAR_BUSINESS_TAGS[group]

    key = normalize_category_name(name)
    return (key,)