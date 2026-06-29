"""Redis 캐시 헬퍼 — get → compute → setex 패턴."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

from redis.asyncio import Redis

_CACHE_TTL = 60 * 60 * 24


async def cache_or_compute(
    redis: Redis,
    key: str,
    compute: Callable[[], Awaitable[Any]],
    ttl: int = _CACHE_TTL,
) -> Any:
    """캐시에서 읽거나 없으면 compute()를 실행하고 결과를 저장한다."""
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)
    result = await compute()
    await redis.setex(key, ttl, json.dumps(result, ensure_ascii=False))
    return result
