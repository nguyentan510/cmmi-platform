import asyncio

from alembic import context

from app.core.config import Settings
from app.db.session import make_engine
from app.db.types import UTCDateTime
from app.models import Base

config = context.config
settings = Settings()
url = settings.database_direct_url or settings.database_url


def render_item(type_, obj, autogen_context):
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime(timezone=True)"
    return False


def run_migrations(connection):
    context.configure(
        connection=connection, target_metadata=Base.metadata, compare_type=True, render_item=render_item
    )
    with context.begin_transaction():
        context.run_migrations()


async def online():
    engine = make_engine(url)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(run_migrations)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(online())
