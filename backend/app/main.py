import uvicorn
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import router as api_v1_router
from app.core.config import get_settings
from app.core.database import get_engine, get_supabase, init_engine
from app.core.redis import init_redis_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_engine()
    await init_redis_pool()

    # ── 데이터 자동 적재(Seeding) 로직 추가 ────────────────────────────────────
    from pathlib import Path
    from app.core.database import get_async_session_factory
    from app.core.seeder import seed_stores_from_csv
    from app.services.store import count_seoul_category

    session_factory = get_async_session_factory()
    async with session_factory() as session:
        try:
            total_stores = await count_seoul_category(session, None)
        except Exception as e:
            print(f'[DB] 테이블 개수 확인 실패 (테이블이 없을 수 있음): {e}')
            total_stores = 0

    if total_stores == 0:
        csv_path = Path(__file__).parent.parent / 'data' / 'sosang_seoul_202603.csv'
        await seed_stores_from_csv(csv_path)
    else:
        print(
            f'[DB] geo_store 테이블에 이미 {total_stores:,}개의 데이터가 존재합니다. '
            '시딩을 건너뜁니다.'
        )

    yield
    await get_engine().dispose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_v1_router, prefix='/api/v1')


@app.get('/')
async def index():
    return {'message': 'Hello World!!!!!!'}


@app.get('/test/db/connect')
async def connect_to_db():
    supabase = get_supabase()
    response = supabase.table('test_db').select('*').execute()
    return response.data


def start_dev():
    load_dotenv('.env.local', override=True)
    settings = get_settings()
    uvicorn.run('app.main:app', host='0.0.0.0', port=settings.app_port, reload=True)


def start_prod():
    load_dotenv('.env', override=True)
    settings = get_settings()
    uvicorn.run('app.main:app', host='127.0.0.1', port=settings.app_port, reload=False)
