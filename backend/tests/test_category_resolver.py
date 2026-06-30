"""category_resolver 유닛 테스트.

LLM·DB 없이 순수 매핑 함수만 검증한다.
"""

from app.core.category_resolver import TARGET, resolve_category, resolve_to_map_key
from app.core.category_map import get_category_filter


class TestResolveCategory:
    """resolve_category: 자연어 → TARGET 업종명."""

    def test_target_name_returns_itself(self):
        """TARGET에 속한 이름은 그대로 반환한다."""
        assert resolve_category('카페') == '카페'
        assert resolve_category('미용실') == '미용실'
        assert resolve_category('치킨') == '치킨'

    def test_alias_maps_to_target(self):
        """등록된 별칭은 TARGET 이름으로 매핑된다."""
        assert resolve_category('커피숍') == '카페'
        assert resolve_category('헤어샵') == '미용실'
        assert resolve_category('삼겹살') == '돼지고기 구이/찜'
        assert resolve_category('분식집') == '김밥/만두/분식'
        assert resolve_category('술집') == '요리 주점'
        assert resolve_category('초밥') == '일식 회/초밥'
        assert resolve_category('빵집') == '빵/도넛'
        assert resolve_category('학원') == '입시·교과학원'
        assert resolve_category('필라테스') == '요가/필라테스 학원'

    def test_unknown_returns_none(self):
        """미등록 업종은 None을 반환한다."""
        assert resolve_category('분식집아님') is None
        assert resolve_category('') is None
        assert resolve_category('뭔가이상한업종') is None

    def test_all_target_names_resolve_to_themselves(self):
        """TARGET 전체 항목이 자기 자신으로 resolve된다."""
        for name in TARGET:
            assert resolve_category(name) == name, f'{name!r} should resolve to itself'


class TestResolveToMapKey:
    """resolve_to_map_key: 자연어 → category_map._MAP 키."""

    def test_known_alias_returns_map_key(self):
        """별칭이 category_map 키로 변환된다."""
        assert resolve_to_map_key('커피숍') == '카페'
        assert resolve_to_map_key('헤어샵') == '미용실'
        assert resolve_to_map_key('삼겹살') == '고깃집'
        assert resolve_to_map_key('학원') == '입시학원'
        assert resolve_to_map_key('필라테스') == '요가필라테스'

    def test_unknown_returns_original(self):
        """미등록 입력은 원문 그대로 반환한다."""
        assert resolve_to_map_key('알수없는업종') == '알수없는업종'

    def test_whitespace_stripped(self):
        """앞뒤 공백은 무시된다."""
        assert resolve_to_map_key('  카페  ') == '카페'

    def test_result_finds_category_filter(self):
        """resolve_to_map_key 결과로 get_category_filter가 None이 아닌 값을 반환한다."""
        aliases = [
            '커피숍',
            '헤어샵',
            '삼겹살',
            '분식집',
            '초밥',
            '빵집',
            '학원',
            '필라테스',
        ]
        for alias in aliases:
            key = resolve_to_map_key(alias)
            result = get_category_filter(alias)
            assert result is not None, (
                f'{alias!r} → key={key!r} → CategoryFilter not found'
            )
