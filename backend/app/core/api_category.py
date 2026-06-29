"""소상공인공단 API 소분류 코드 → 서비스 display_name 역매핑.

store.py에서 API 응답의 indsSclsCd를 카테고리 표시명으로 변환할 때 사용한다.
"""

from app.core.category_map import _MAP

# small_code → display_name 역매핑 (예: 'I21201' → '카페')
_SMALL_CODE_TO_DISPLAY: dict[str, str] = {
    sc: display_name
    for display_name, cat_filter in _MAP.items()
    for sc in cat_filter.small_codes
}


def resolve_category_display(small_code: str, fallback: str = '') -> str:
    """소분류 코드를 서비스 display_name으로 변환한다.

    매핑이 없으면 fallback(API 중분류명 등)을 반환한다.
    """
    return _SMALL_CODE_TO_DISPLAY.get(small_code, fallback.strip())
