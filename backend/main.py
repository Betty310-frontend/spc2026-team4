import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from supabase import Client, create_client

app = FastAPI()

_supabase: Client = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get('SUPABASE_URL')
        key = os.environ.get('SUPABASE_KEY')
        if not url or not key:
            raise ValueError('환경변수 설정 error')
        _supabase = create_client(url, key)
    return _supabase


@app.get('/')
async def index():
    return {'message': 'Hello World!!!!!!'}


@app.get('/test/db/connect')
async def connect_to_db():
    supabase = get_supabase()
    response = supabase.table('test_db').select('*').execute()
    names = response.data
    return names


def start_dev():
    load_dotenv('.env.local', override=True)
    uvicorn.run('main:app', host='127.0.0.1', port=8000, reload=True)


def start_prod():
    load_dotenv('.env', override=True)
    uvicorn.run('main:app', host='127.0.0.1', port=8000, reload=False)
