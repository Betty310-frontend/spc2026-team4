from collections.abc import AsyncGenerator

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client

from app.core.database import get_async_session_factory
from app.core.database import get_supabase as _get_supabase
from app.core.redis import get_redis


def get_db(client: Client = Depends(_get_supabase)) -> Client:
    """Supabase REST client — 기존 엔드포인트 하위 호환용."""
    return client


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """SQLAlchemy AsyncSession — ORM 쿼리 및 PostGIS 공간 쿼리용."""
    async_session = get_async_session_factory()
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_redis_client() -> AsyncGenerator[Redis, None]:
    """Redis 비동기 클라이언트 — TTL 24h 캐시용."""
    client = get_redis()
    try:
        yield client
    finally:
        await client.aclose()
