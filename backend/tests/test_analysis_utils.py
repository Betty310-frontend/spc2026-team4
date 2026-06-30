"""analysis_utils 유닛 테스트.

DB·외부 API 없이 순수 계산 함수만 검증한다.
"""

from app.core.analysis_utils import (
    build_h3_hexagons,
    calc_competition_percentile,
    calc_percentile,
)

CENTER_LAT = 37.5563  # 홍대
CENTER_LNG = 126.9236


class TestCalcPercentile:
    """calc_percentile: 기준값 목록 대비 퍼센타일."""

    def test_empty_reference_returns_50(self):
        assert calc_percentile(100.0, []) == 50

    def test_value_above_all_returns_100(self):
        assert calc_percentile(999.0, [1.0, 2.0, 3.0]) == 100

    def test_value_below_all_returns_0(self):
        assert calc_percentile(0.0, [1.0, 2.0, 3.0]) == 0

    def test_median_value_returns_near_50(self):
        refs = list(range(1, 101))  # 1~100
        result = calc_percentile(50.0, refs)
        assert 45 <= result <= 55

    def test_single_reference_above_returns_0(self):
        assert calc_percentile(1.0, [5.0]) == 0

    def test_single_reference_below_returns_100(self):
        assert calc_percentile(10.0, [5.0]) == 100


class TestCalcCompetitionPercentile:
    """calc_competition_percentile: 경쟁 밀집도 퍼센타일."""

    def test_zero_seoul_total_returns_50(self):
        assert calc_competition_percentile(10, 500, 0) == 50

    def test_zero_competitors_returns_0(self):
        result = calc_competition_percentile(0, 500, 5000)
        assert result == 0

    def test_result_clamped_to_100(self):
        result = calc_competition_percentile(99999, 500, 1)
        assert result == 100

    def test_result_clamped_to_0(self):
        result = calc_competition_percentile(0, 500, 99999)
        assert result == 0

    def test_returns_int(self):
        result = calc_competition_percentile(5, 500, 5000)
        assert isinstance(result, int)


class TestBuildH3Hexagons:
    """build_h3_hexagons: 반경 내 H3 셀 생성 및 경쟁업체 집계."""

    def test_empty_competitors_returns_cells_with_zero_count(self):
        """경쟁업체 없어도 커버리지 내 셀이 생성되고 count=0이다."""
        result = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=500
        )
        assert len(result) > 0
        assert all(r['count'] == 0 for r in result)

    def test_result_has_required_keys(self):
        """각 항목에 h3Index와 count 키가 있다."""
        result = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=500
        )
        for item in result:
            assert 'h3Index' in item
            assert 'count' in item

    def test_competitor_at_center_has_nonzero_count(self):
        """중심 좌표 근처 경쟁업체는 해당 셀의 count에 반영된다."""
        competitors = [{'lat': CENTER_LAT, 'lng': CENTER_LNG}]
        result = build_h3_hexagons(
            competitors, center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=500
        )
        total_count = sum(r['count'] for r in result)
        assert total_count == 1

    def test_multiple_competitors_sum_correctly(self):
        """경쟁업체 3개의 count 합계가 3이다."""
        competitors = [
            {'lat': CENTER_LAT, 'lng': CENTER_LNG},
            {'lat': CENTER_LAT + 0.001, 'lng': CENTER_LNG},
            {'lat': CENTER_LAT, 'lng': CENTER_LNG + 0.001},
        ]
        result = build_h3_hexagons(
            competitors, center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=500
        )
        assert sum(r['count'] for r in result) == 3

    def test_small_radius_coverage_clamped_to_minimum(self):
        """반경이 매우 작아도 최소 커버리지(700m)가 적용돼 셀이 생성된다."""
        result = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=100
        )
        assert len(result) > 0

    def test_large_radius_coverage_clamped_to_maximum(self):
        """반경이 매우 커도 최대 커버리지(1200m)로 클램핑된다."""
        result_large = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=2000
        )
        result_medium = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=1000
        )
        # 둘 다 1200m로 클램핑되므로 셀 수가 같아야 한다
        assert len(result_large) == len(result_medium)

    def test_h3_index_format(self):
        """h3Index 값이 유효한 H3 인덱스 문자열이다."""
        import h3 as h3lib

        result = build_h3_hexagons(
            [], center_lat=CENTER_LAT, center_lng=CENTER_LNG, radius_m=500
        )
        for item in result:
            assert h3lib.is_valid_cell(item['h3Index']), (
                f'invalid h3: {item["h3Index"]}'
            )
