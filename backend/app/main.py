from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.api.v1.api import router as api_v1_router
from app.core.config import get_settings
from app.core.database import get_engine, init_engine
from app.core.redis import init_redis_pool
from app.entities.base import Base
from app.entities.local_people import LocalPeople
from app.entities.sales import SeoulSales
from app.entities.store import Store

from pydantic import BaseModel

from app.services.rag_service import generate_rag_answer, search_rag_chunks


DATA_DIR = Path(__file__).parent.parent / 'data'


async def _ensure_tables() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('[DB] 테이블 스키마 동기화 완료')


async def _count(model) -> int:
    from app.core.database import get_async_session_factory

    session_factory = get_async_session_factory()
    async with session_factory() as session:
        try:
            return (
                await session.execute(select(func.count()).select_from(model))
            ).scalar_one()
        except Exception:
            return 0


async def _run_seeding() -> None:
    from app.core.seeder import (
        seed_local_people_from_csv,
        seed_sales_from_csv,
        seed_stores_from_csv,
    )

    # geo_store
    store_csv = DATA_DIR / 'sosang_seoul_202603.csv'
    if await _count(Store) == 0:
        await seed_stores_from_csv(store_csv)
    else:
        print('[SEED] geo_store: 이미 데이터 존재, 스킵')

    # seoul_sales
    sales_csvs = [DATA_DIR / f'seoul_sales_{y}.csv' for y in (2023, 2024, 2025)]
    sales_csvs = [p for p in sales_csvs if p.exists()]
    if sales_csvs and await _count(SeoulSales) == 0:
        await seed_sales_from_csv(sales_csvs)
    elif not sales_csvs:
        print('[SEED] seoul_sales: CSV 파일 없음, 스킵')
    else:
        print('[SEED] seoul_sales: 이미 데이터 존재, 스킵')

    # local_people
    lp_csvs = sorted(DATA_DIR.glob('local_people_*.csv'))
    if lp_csvs and await _count(LocalPeople) == 0:
        await seed_local_people_from_csv(lp_csvs)
    elif not lp_csvs:
        print('[SEED] local_people: CSV 파일 없음, 스킵')
    else:
        print('[SEED] local_people: 이미 데이터 존재, 스킵')


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_engine()
    await init_redis_pool()
    await _ensure_tables()
    await _run_seeding()
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


def start_dev():
    load_dotenv('.env.local', override=True)
    settings = get_settings()
    uvicorn.run('app.main:app', host='0.0.0.0', port=settings.app_port, reload=True)


def start_prod():
    load_dotenv('.env', override=True)
    settings = get_settings()
    uvicorn.run('app.main:app', host='127.0.0.1', port=settings.app_port, reload=False)


class ChatRequest(BaseModel):
    message: str
    display_name: str


@app.post("/api/v1/chat")
def chat(request: ChatRequest):
    result = generate_rag_answer(
        display_name=request.display_name,
        question=request.message,
    )

    return {
        "display_name": request.display_name,
        "message": request.message,
        "answer": result["answer"],
        "sources": result["sources"],
    }


@app.get("/api/v1/rag/search")
def rag_search(display_name: str, question: str):
    return {
        "display_name": display_name,
        "question": question,
        "results": search_rag_chunks(display_name, question),
    }