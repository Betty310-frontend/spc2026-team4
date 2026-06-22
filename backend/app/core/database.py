from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from supabase import Client, create_client

from app.core.config import get_settings

# ── Supabase REST client (기존 유지) ───────────────────────────────────────────
_supabase: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            raise ValueError('환경변수 설정 error')
        _supabase = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase


# ── SQLAlchemy async engine / session ─────────────────────────────────────────
_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


async def _try_engine(url: str) -> AsyncEngine | None:
    engine = create_async_engine(url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        return engine
    except Exception:
        await engine.dispose()
        return None


async def init_engine() -> None:
    global _engine, _async_session_factory
    settings = get_settings()

    engine = await _try_engine(settings.pg_local_url)
    if engine:
        print(f'[DB] 로컬 연결 성공: {settings.pg_local_url}')
        _engine = engine
        _async_session_factory = async_sessionmaker(
            bind=_engine, class_=AsyncSession, expire_on_commit=False
        )
        return

    print(f'[DB] 로컬 연결 실패: {settings.pg_local_url}')

    if not settings.pg_cloud_url:
        raise RuntimeError(
            '[DB] 로컬 연결 실패 — .env.local에 DATABASE_CLOUD_URL을 설정하세요.'
        )

    engine = await _try_engine(settings.pg_cloud_url)
    if engine:
        print('[DB] 클라우드 연결 성공')
        _engine = engine
        _async_session_factory = async_sessionmaker(
            bind=_engine, class_=AsyncSession, expire_on_commit=False
        )
        return

    raise RuntimeError('[DB] 로컬/클라우드 모두 연결 불가')


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError('DB 엔진이 초기화되지 않았습니다.')
    return _engine


def get_async_session_factory() -> async_sessionmaker[AsyncSession]:
    if _async_session_factory is None:
        raise RuntimeError('DB 세션 팩토리가 초기화되지 않았습니다.')
    return _async_session_factory
