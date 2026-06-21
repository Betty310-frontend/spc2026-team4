from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env.local', env_file_encoding='utf-8', extra='ignore'
    )

    app_env: str = 'development'
    app_port: int = 8000

    openai_api_key: str = ''
    openai_model_name: str = ''

    supabase_url: str = ''
    supabase_key: str = ''

    pg_local_url: str = ''
    pg_cloud_url: str = ''
    redis_local_url: str = ''
    redis_cloud_url: str = ''

    public_data_api_key: str = ''
    public_api_key: str = ''
    people_api_key: str = ''
    trdar_api_key: str = ''

    kakao_rest_api_key: str = ''


@lru_cache
def get_settings() -> Settings:
    return Settings()
