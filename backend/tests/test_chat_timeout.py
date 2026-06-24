"""에이전트 타임아웃 처리 및 SSE 에러 포맷 유닛 테스트."""

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.chat import _sse
from app.services.chat_tools import make_analysis_tools


# ---------------------------------------------------------------------------
# _sse — SSE 직렬화 포맷
# ---------------------------------------------------------------------------


class TestSseFormat:
    def test_sse_starts_with_data_prefix(self):
        result = _sse({'type': 'step', 'label': '테스트'})
        assert result.startswith('data: ')

    def test_sse_ends_with_double_newline(self):
        result = _sse({'type': 'step', 'label': '테스트'})
        assert result.endswith('\n\n')

    def test_sse_body_is_valid_json(self):
        payload = {'type': 'error', 'code': 'TIMEOUT', 'message': '초과'}
        result = _sse(payload)
        body = result[len('data: ') :].strip()
        parsed = json.loads(body)
        assert parsed == payload

    def test_sse_error_has_code_and_message(self):
        payload = {'type': 'error', 'code': 'AGENT_ERROR', 'message': '오류'}
        body = json.loads(_sse(payload)[len('data: ') :].strip())
        assert body['type'] == 'error'
        assert 'code' in body
        assert 'message' in body

    def test_sse_preserves_korean(self):
        payload = {'type': 'text-delta', 'delta': '안녕하세요'}
        body = json.loads(_sse(payload)[len('data: ') :].strip())
        assert body['delta'] == '안녕하세요'

    def test_sse_korean_not_unicode_escaped(self):
        """ensure_ascii=False 설정으로 한글이 \\uXXXX가 아닌 원문으로 직렬화된다."""
        result = _sse({'delta': '안녕'})
        assert '안녕' in result
        assert '\\u' not in result

    def test_sse_empty_payload(self):
        result = _sse({})
        body = json.loads(result[len('data: ') :].strip())
        assert body == {}

    def test_sse_timeout_error_code(self):
        payload = {'type': 'error', 'code': 'TIMEOUT', 'message': '초과'}
        body = json.loads(_sse(payload)[len('data: ') :].strip())
        assert body['code'] == 'TIMEOUT'

    def test_sse_cancelled_error_code(self):
        payload = {'type': 'error', 'code': 'CANCELLED', 'message': '취소'}
        body = json.loads(_sse(payload)[len('data: ') :].strip())
        assert body['code'] == 'CANCELLED'

    def test_sse_agent_error_code(self):
        payload = {'type': 'error', 'code': 'AGENT_ERROR', 'message': '오류'}
        body = json.loads(_sse(payload)[len('data: ') :].strip())
        assert body['code'] == 'AGENT_ERROR'

    def test_sse_data_prefix_length(self):
        """'data: ' 접두사가 정확히 6자인지 확인한다 (SSE 프로토콜 규격)."""
        result = _sse({'type': 'step'})
        assert result[:6] == 'data: '


# ---------------------------------------------------------------------------
# 도구별 타임아웃 — asyncio.timeout 전파 확인
# ---------------------------------------------------------------------------


class TestToolTimeout:
    def test_search_competitors_raises_on_slow_analysis(self):
        """run_market_analysis가 타임아웃보다 오래 걸리면 asyncio.TimeoutError가 전파된다."""

        async def slow_analysis(*args, **kwargs):
            await asyncio.sleep(10)

        async def _run():
            with (
                patch('app.services.chat_tools._TOOL_TIMEOUT', 0.05),
                patch('app.services.chat_tools.run_market_analysis', slow_analysis),
            ):
                tools = make_analysis_tools(AsyncMock(), AsyncMock())
                search_tool = next(t for t in tools if t.name == 'search_competitors')
                with pytest.raises(asyncio.TimeoutError):
                    await search_tool.ainvoke(
                        {'station': '연남동', 'category': '카페', 'radius': 500}
                    )

        asyncio.run(_run())

    def test_get_population_flow_raises_on_slow_analysis(self):
        async def slow_population(*args, **kwargs):
            await asyncio.sleep(10)

        async def _run():
            with (
                patch('app.services.chat_tools._TOOL_TIMEOUT', 0.05),
                patch('app.services.chat_tools.run_get_population', slow_population),
            ):
                tools = make_analysis_tools(AsyncMock(), AsyncMock())
                pop_tool = next(t for t in tools if t.name == 'get_population_flow')
                with pytest.raises(asyncio.TimeoutError):
                    await pop_tool.ainvoke(
                        {'station': '연남동', 'category': '카페', 'radius': 500}
                    )

        asyncio.run(_run())

    def test_calc_competition_percentile_raises_on_slow_analysis(self):
        async def slow_analysis(*args, **kwargs):
            await asyncio.sleep(10)

        async def _run():
            with (
                patch('app.services.chat_tools._TOOL_TIMEOUT', 0.05),
                patch('app.services.chat_tools.run_market_analysis', slow_analysis),
            ):
                tools = make_analysis_tools(AsyncMock(), AsyncMock())
                pct_tool = next(
                    t for t in tools if t.name == 'calc_competition_percentile'
                )
                with pytest.raises(asyncio.TimeoutError):
                    await pct_tool.ainvoke(
                        {'station': '연남동', 'category': '카페', 'radius': 500}
                    )

        asyncio.run(_run())

    def test_fast_analysis_completes_within_timeout(self):
        """정상 응답은 타임아웃 없이 반환된다."""

        async def fast_analysis(*args, **kwargs):
            return {
                'metrics': {'competitor_count': 5, 'competition_percentile': 60},
                'competitors': [],
                'coords': {'lat': 37.55, 'lng': 126.92},
                'dong_name': '연남동',
                'h3_hexagons': [],
                'summarize': {},
                'scope': {},
                'sources': [],
                'tags': [],
                'station': '연남동',
                'radius': 500,
                'category': '카페',
            }

        async def _run():
            with (
                patch('app.services.chat_tools._TOOL_TIMEOUT', 5),
                patch('app.services.chat_tools.run_market_analysis', fast_analysis),
            ):
                tools = make_analysis_tools(AsyncMock(), AsyncMock())
                search_tool = next(t for t in tools if t.name == 'search_competitors')
                result = await search_tool.ainvoke(
                    {'station': '연남동', 'category': '카페', 'radius': 500}
                )
                assert result['metrics']['competitor_count'] == 5

        asyncio.run(_run())

    def test_tool_timeout_constant_is_reasonable(self):
        """_TOOL_TIMEOUT이 전체 90s 제한보다 작고 0보다 큰지 확인한다."""
        import app.services.chat_tools as ct

        assert 0 < ct._TOOL_TIMEOUT < 90

    def test_all_expected_tools_are_registered(self):
        """make_analysis_tools가 4개 도구를 모두 반환하는지 확인한다."""
        tools = make_analysis_tools(AsyncMock(), AsyncMock())
        names = {t.name for t in tools}
        expected = {
            'search_competitors',
            'get_population_flow',
            'calc_competition_percentile',
            'get_positioning_data',
        }
        assert names == expected

    def test_stub_tools_return_available_false(self):
        """get_positioning_data 스텁은 available=False를 반환한다."""

        async def _run():
            tools = make_analysis_tools(AsyncMock(), AsyncMock())
            pos_tool = next(t for t in tools if t.name == 'get_positioning_data')
            pos_result = await pos_tool.ainvoke(
                {'station': '연남동', 'category': '카페', 'radius': 500}
            )
            assert pos_result['available'] is False

        asyncio.run(_run())
