from supabase import Client, create_client

from app.core.config import get_settings

_supabase: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            raise ValueError('환경변수 설정 error')
        _supabase = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase
