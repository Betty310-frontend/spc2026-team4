"""시스템 프롬프트 규칙 및 지리 참조 로직 유닛 테스트.

LLM·DB·외부 API 호출 없이 순수 함수와 설정값만 검증한다.
"""

import pytest

from app.core.geo import DEFAULT_COORDS, STATION_COORDS, geocode_station, resolve_coords
from app.services.chat import _SYSTEM

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# 시스템 프롬프트 규칙 검증
# ---------------------------------------------------------------------------


class TestSystemPromptRules:
    """_SYSTEM 프롬프트에 필수 규칙이 존재하는지 검증한다.

    LLM 응답 자체는 비결정적이므로, 규칙이 프롬프트에 선언되어 있는지를 테스트한다.
    """

    def test_category_askback_rule_exists(self):
        """업종 누락 시 되묻기 규칙이 프롬프트에 포함되어야 한다."""
        assert '업종 누락' in _SYSTEM
        assert '어떤 업종을 생각하고 계신가요' in _SYSTEM

    def test_seoul_region_rule_not_too_broad(self):
        """서울 지역 제한이 타 시·도 기준으로 명확히 제한되어야 한다."""
        # 과거의 잘못된 규칙("서울지역이 아니면") 이 없어야 한다
        assert '서울지역이 아니면' not in _SYSTEM

    def test_seoul_dongnames_listed_as_seoul(self):
        """서울 내 대표 동네명이 서울 지역 예시로 명시되어야 한다."""
        assert '여의도' in _SYSTEM
        assert '신당동' in _SYSTEM

    def test_non_seoul_cities_listed(self):
        """분석 불가 지역으로 타 광역시·도가 명시되어야 한다."""
        assert '부산' in _SYSTEM
        assert '대구' in _SYSTEM

    def test_category_normalization_rules_exist(self):
        """업종 정규화 규칙(카페, 미용실 등)이 포함되어야 한다."""
        assert '카페' in _SYSTEM
        assert '미용실' in _SYSTEM

    def test_brand_masking_rule_exists(self):
        """상호명 비식별화 규칙이 포함되어야 한다."""
        assert '*' in _SYSTEM


# ---------------------------------------------------------------------------
# resolve_coords — 순수 함수 테스트
# ---------------------------------------------------------------------------


class TestResolveCoords:
    """resolve_coords: STATION_COORDS 딕셔너리 기반 좌표 반환."""

    def test_registered_station_returns_correct_coords(self):
        """등록된 역명은 정확한 좌표를 반환해야 한다."""
        coords = resolve_coords('강남역')
        assert coords['lat'] == pytest.approx(37.4979, abs=0.001)
        assert coords['lng'] == pytest.approx(127.0276, abs=0.001)

    def test_registered_neighborhood_returns_correct_coords(self):
        """등록된 동네명은 정확한 좌표를 반환해야 한다."""
        coords = resolve_coords('연남동')
        assert coords['lat'] == pytest.approx(37.5661, abs=0.001)
        assert coords['lng'] == pytest.approx(126.9229, abs=0.001)

    def test_unregistered_location_returns_default(self):
        """미등록 지역은 서울 중심 기본값을 반환한다 (현재 알려진 한계)."""
        # 삼성동, 용산구 등 미등록 지역 → DEFAULT_COORDS 반환
        assert resolve_coords('삼성동') == DEFAULT_COORDS
        assert resolve_coords('용산구') == DEFAULT_COORDS
        assert resolve_coords('신당동') == DEFAULT_COORDS
        assert resolve_coords('여의도') == DEFAULT_COORDS

    def test_default_coords_is_seoul_center(self):
        """기본 좌표는 서울 중심(시청 근처)이어야 한다."""
        assert DEFAULT_COORDS['lat'] == pytest.approx(37.5665, abs=0.001)
        assert DEFAULT_COORDS['lng'] == pytest.approx(126.9780, abs=0.001)

    def test_all_registered_stations_have_valid_seoul_coords(self):
        """STATION_COORDS 내 모든 좌표가 서울 범위 내에 있어야 한다."""
        # 서울 위경도 범위: lat 37.4~37.7, lng 126.7~127.2
        for name, coords in STATION_COORDS.items():
            assert 37.4 <= coords['lat'] <= 37.7, f'{name} lat 범위 초과'
            assert 126.7 <= coords['lng'] <= 127.2, f'{name} lng 범위 초과'


# ---------------------------------------------------------------------------
# geocode_station — 카카오 API 폴백 테스트 (httpx mock)
# ---------------------------------------------------------------------------


class FakeResponse:
    def __init__(self, json_data: dict, status_code: int = 200):
        self._json = json_data
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f'HTTP {self.status_code}')


class FakeHttpxClient:
    def __init__(self, response: FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, url: str, **kwargs):
        return self._response


class TestGeocodeStation:
    """geocode_station: 딕셔너리 → Redis → 카카오 API → DEFAULT_COORDS 순서 검증."""

    async def test_registered_station_skips_api(self):
        """STATION_COORDS에 등록된 역은 API 호출 없이 즉시 반환해야 한다."""
        result = await geocode_station('강남역', kakao_key='dummy', redis=None)
        assert result['lat'] == pytest.approx(37.4979, abs=0.001)
        assert result['lng'] == pytest.approx(127.0276, abs=0.001)

    async def test_api_failure_returns_default_coords(self, monkeypatch):
        """카카오 API 호출 실패 시 DEFAULT_COORDS를 반환해야 한다."""
        import httpx

        class BrokenClient:
            async def __aenter__(self):
                raise RuntimeError('네트워크 오류')

            async def __aexit__(self, *a):
                pass

        monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: BrokenClient())

        result = await geocode_station('삼성동', kakao_key='invalid_key', redis=None)
        assert result == DEFAULT_COORDS

    async def test_api_empty_result_returns_default_coords(self, monkeypatch):
        """카카오 API가 빈 결과를 반환하면 DEFAULT_COORDS를 반환해야 한다."""
        import httpx

        fake_resp = FakeResponse({'documents': []})
        fake_client = FakeHttpxClient(fake_resp)
        monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: fake_client)

        result = await geocode_station(
            '존재하지않는동네XYZ', kakao_key='test_key', redis=None
        )
        assert result == DEFAULT_COORDS

    async def test_api_success_returns_kakao_coords(self, monkeypatch):
        """카카오 API 성공 시 반환된 좌표를 그대로 사용해야 한다."""
        import httpx

        fake_resp = FakeResponse({'documents': [{'x': '127.0276', 'y': '37.4979'}]})
        fake_client = FakeHttpxClient(fake_resp)
        monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: fake_client)

        result = await geocode_station('삼성동', kakao_key='test_key', redis=None)
        assert result['lat'] == pytest.approx(37.4979, abs=0.001)
        assert result['lng'] == pytest.approx(127.0276, abs=0.001)
