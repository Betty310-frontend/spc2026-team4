import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.core.config import get_settings
from app.entities.base import Base  # noqa: F401
from app.entities.store import Store  # noqa: F401
from app.entities.sales import SeoulSales  # noqa: F401
from app.entities.local_people import LocalPeople  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    settings = get_settings()
    return settings.pg_cloud_url or settings.pg_local_url


async def get_url_async() -> str:
    settings = get_settings()
    # Try local database first, fallback to cloud database if local fails
    try:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine
        engine = create_async_engine(settings.pg_local_url)
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        await engine.dispose()
        return settings.pg_local_url
    except Exception:
        return settings.pg_cloud_url or settings.pg_local_url


def include_object(object, name, type_, reflected, compare_to):
    # DB에는 존재하지만 우리 메타데이터에 없는 테이블(PostGIS 시스템 테이블 등)은 무시
    if type_ == 'table' and reflected and compare_to is None:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    ini_section = config.get_section(config.config_ini_section, {})
    db_url = await get_url_async()
    ini_section['sqlalchemy.url'] = db_url

    connectable = async_engine_from_config(
        ini_section,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
