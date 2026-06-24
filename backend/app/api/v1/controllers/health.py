from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import get_async_session_factory
from app.core.redis import get_redis

router = APIRouter()


async def _check_db() -> tuple[str, str | None]:
    try:
        factory = get_async_session_factory()
        async with factory() as session:
            await session.execute(text('SELECT 1'))
        return 'ok', None
    except Exception as e:
        return 'error', str(e)


async def _check_redis() -> tuple[str, str | None]:
    try:
        redis = get_redis()
        await redis.ping()
        await redis.aclose()
        return 'ok', None
    except Exception as e:
        return 'error', str(e)


@router.get('/health')
async def health_check():
    db_status, db_error = await _check_db()
    redis_status, redis_error = await _check_redis()

    overall = 'ok' if db_status == 'ok' and redis_status == 'ok' else 'degraded'

    result = {
        'status': overall,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'services': {
            'database': {'status': db_status},
            'redis': {'status': redis_status},
        },
    }

    if db_error:
        result['services']['database']['error'] = db_error
    if redis_error:
        result['services']['redis']['error'] = redis_error

    return result
