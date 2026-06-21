from fastapi import Depends
from supabase import Client

from app.core.database import get_supabase as _get_supabase


def get_db(client: Client = Depends(_get_supabase)) -> Client:
    return client
