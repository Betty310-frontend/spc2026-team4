"""분석 조건 변경 감지 및 Redis 컨텍스트 저장/로드 유닛 테스트."""

import asyncio

from app.services.chat import _detect_context_change, _load_last_context, _save_context


# ---------------------------------------------------------------------------
# FakeRedis — 실제 Redis 연결 없이 동작하는 in-memory 스텁
# ---------------------------------------------------------------------------


class FakeRedis:
    def __init__(self):
        self._data: dict[str, bytes] = {}

    async def get(self, key: str):
        return self._data.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self._data[key] = value.encode() if isinstance(value, str) else value


# ---------------------------------------------------------------------------
# _detect_context_change — 순수 함수 테스트
# ---------------------------------------------------------------------------


class TestDetectContextChange:
    def test_no_change_returns_none(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        assert _detect_context_change(prev, '연남동', '카페', 500) is None

    def test_empty_prev_returns_none(self):
        assert _detect_context_change({}, '연남동', '카페', 500) is None

    def test_station_changed(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '홍대입구역', '카페', 500)
        assert result is not None
        assert '위치 연남동 → 홍대입구역' in result

    def test_category_changed(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '연남동', '미용실', 500)
        assert result is not None
        assert '업종 카페 → 미용실' in result

    def test_radius_changed(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '연남동', '카페', 1000)
        assert result is not None
        assert '반경 500m → 1000m' in result

    def test_all_fields_changed(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '강남역', '음식점', 300)
        assert result is not None
        assert '위치' in result
        assert '업종' in result
        assert '반경' in result

    def test_partial_change_only_shows_changed_fields(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '연남동', '카페', 1000)
        assert '위치' not in result
        assert '업종' not in result
        assert '반경' in result

    def test_return_type_is_str_when_changed(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '강남역', '카페', 500)
        assert isinstance(result, str)

    def test_multiple_changes_joined_with_comma(self):
        """변경 항목이 2개 이상이면 ', '로 구분된다."""
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '강남역', '음식점', 500)
        assert result is not None
        parts = result.split(', ')
        assert len(parts) == 2

    def test_all_three_changes_produce_three_parts(self):
        prev = {'station': '연남동', 'category': '카페', 'radius': 500}
        result = _detect_context_change(prev, '강남역', '음식점', 300)
        parts = result.split(', ')
        assert len(parts) == 3


# ---------------------------------------------------------------------------
# _save_context / _load_last_context — 비동기 Redis 저장·로드
# ---------------------------------------------------------------------------


class TestContextRedis:
    def test_save_and_load_roundtrip(self):
        async def _run():
            redis = FakeRedis()
            await _save_context(redis, 'thread-abc', '연남동', '카페', 500)
            ctx = await _load_last_context(redis, 'thread-abc')
            assert ctx == {'station': '연남동', 'category': '카페', 'radius': 500}

        asyncio.run(_run())

    def test_load_missing_key_returns_empty_dict(self):
        async def _run():
            redis = FakeRedis()
            ctx = await _load_last_context(redis, 'nonexistent-thread')
            assert ctx == {}

        asyncio.run(_run())

    def test_load_corrupted_json_returns_empty_dict(self):
        async def _run():
            redis = FakeRedis()
            redis._data['ctx:bad-thread'] = b'not-valid-json{'
            ctx = await _load_last_context(redis, 'bad-thread')
            assert ctx == {}

        asyncio.run(_run())

    def test_different_threads_are_isolated(self):
        async def _run():
            redis = FakeRedis()
            await _save_context(redis, 'thread-1', '연남동', '카페', 500)
            await _save_context(redis, 'thread-2', '강남역', '음식점', 300)
            ctx1 = await _load_last_context(redis, 'thread-1')
            ctx2 = await _load_last_context(redis, 'thread-2')
            assert ctx1['station'] == '연남동'
            assert ctx2['station'] == '강남역'

        asyncio.run(_run())

    def test_overwrite_updates_existing_context(self):
        async def _run():
            redis = FakeRedis()
            await _save_context(redis, 'thread-x', '연남동', '카페', 500)
            await _save_context(redis, 'thread-x', '홍대입구역', '카페', 1000)
            ctx = await _load_last_context(redis, 'thread-x')
            assert ctx['station'] == '홍대입구역'
            assert ctx['radius'] == 1000

        asyncio.run(_run())

    def test_save_uses_24h_ttl(self):
        """setex 호출 시 TTL이 86400(24h)인지 확인한다."""
        recorded: list[int] = []

        class CapturingRedis(FakeRedis):
            async def setex(self, key, ttl, value):
                recorded.append(ttl)
                await super().setex(key, ttl, value)

        async def _run():
            redis = CapturingRedis()
            await _save_context(redis, 'thread-ttl', '연남동', '카페', 500)
            assert recorded == [86400]

        asyncio.run(_run())

    def test_redis_key_format_is_ctx_prefix(self):
        """저장 키가 'ctx:{thread_id}' 형식인지 확인한다."""
        recorded_keys: list[str] = []

        class CapturingRedis(FakeRedis):
            async def setex(self, key, ttl, value):
                recorded_keys.append(key)
                await super().setex(key, ttl, value)

        async def _run():
            redis = CapturingRedis()
            await _save_context(redis, 'my-thread', '연남동', '카페', 500)
            assert recorded_keys == ['ctx:my-thread']

        asyncio.run(_run())

    def test_load_uses_same_key_as_save(self):
        """load가 save와 동일한 키를 조회하는지 확인한다."""
        read_keys: list[str] = []

        class CapturingRedis(FakeRedis):
            async def get(self, key):
                read_keys.append(key)
                return await super().get(key)

        async def _run():
            redis = CapturingRedis()
            await _save_context(redis, 'my-thread', '연남동', '카페', 500)
            read_keys.clear()
            await _load_last_context(redis, 'my-thread')
            assert read_keys == ['ctx:my-thread']

        asyncio.run(_run())

    def test_radius_type_preserved_after_roundtrip(self):
        """JSON 직렬화 후 radius가 문자열이 아닌 int로 복원된다."""

        async def _run():
            redis = FakeRedis()
            await _save_context(redis, 'thread-type', '연남동', '카페', 500)
            ctx = await _load_last_context(redis, 'thread-type')
            assert isinstance(ctx['radius'], int)
            assert ctx['radius'] == 500

        asyncio.run(_run())

    def test_detect_no_false_positive_on_numeric_string_station(self):
        """이전 조건과 현재 조건이 동일하면 변경 없음으로 판단한다 (경계값)."""
        prev = {'station': '2호선강남역', 'category': '카페', 'radius': 500}
        assert _detect_context_change(prev, '2호선강남역', '카페', 500) is None
