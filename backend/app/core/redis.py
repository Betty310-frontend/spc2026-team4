from redis.asyncio import ConnectionPool, Redis

from app.core.config import get_settings

_redis_pool: ConnectionPool | None = None


async def _try_pool(url: str) -> ConnectionPool | None:
    pool = ConnectionPool.from_url(url, max_connections=20, decode_responses=True)
    client = Redis(connection_pool=pool)
    try:
        await client.ping()
        return pool
    except Exception:
        return None
    finally:
        await client.aclose()


async def init_redis_pool() -> None:
    global _redis_pool
    settings = get_settings()

    pool = await _try_pool(settings.redis_local_url)
    if pool:
        print(f'[Redis] 로컬 연결 성공: {settings.redis_local_url}')
        _redis_pool = pool
        return

    print(f'[Redis] 로컬 연결 실패: {settings.redis_local_url}')

    if settings.redis_cloud_url:
        pool = await _try_pool(settings.redis_cloud_url)
        if pool:
            print('[Redis] 클라우드 연결 성공')
            _redis_pool = pool
            return
        print('[Redis] 클라우드 연결 실패')

    raise RuntimeError('[Redis] 로컬/클라우드 모두 연결 불가')


def get_redis_pool() -> ConnectionPool:
    if _redis_pool is None:
        raise RuntimeError('Redis pool이 초기화되지 않았습니다.')
    return _redis_pool


def get_redis() -> Redis:
    return Redis(connection_pool=get_redis_pool())


def encode_geohash(latitude: float, longitude: float, precision: int = 7) -> str:
    """위/경도를 Geohash 문자열로 인코딩합니다."""
    base32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    lat_interval = (-90.0, 90.0)
    lon_interval = (-180.0, 180.0)
    geohash: list[str] = []
    bits = 0
    ch = 0
    even_bit = True

    while len(geohash) < precision:
        if even_bit:
            mid = (lon_interval[0] + lon_interval[1]) / 2.0
            if longitude > mid:
                ch = (ch << 1) | 1
                lon_interval = (mid, lon_interval[1])
            else:
                ch = (ch << 1) | 0
                lon_interval = (lon_interval[0], mid)
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if latitude > mid:
                ch = (ch << 1) | 1
                lat_interval = (mid, lat_interval[1])
            else:
                ch = (ch << 1) | 0
                lat_interval = (lat_interval[0], mid)
        even_bit = not even_bit
        bits += 1
        if bits == 5:
            geohash.append(base32[ch])
            bits = 0
            ch = 0

    return "".join(geohash)
