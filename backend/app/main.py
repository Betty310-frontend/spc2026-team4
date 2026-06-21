import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import router as api_v1_router
from app.core.config import get_settings
from app.core.database import get_supabase

app = FastAPI()

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
