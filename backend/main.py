import os

from dotenv import load_dotenv
from fastapi import FastAPI
from supabase import Client, create_client

load_dotenv('.env/local.env')
app = FastAPI(port=8000)

supabase: Client = create_client(
    os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_KEY')
)


@app.get('/')
async def index():
    return {'message': 'Hello World!!!!!!'}


@app.get('/test/db/connect')
async def connect_to_db():
    response = supabase.table('test_db').select('*').execute()
    names = response.data
    return names
