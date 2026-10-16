import asyncio
from contextlib import asynccontextmanager

from sqlalchemy import event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

LOCK_ID = 84390514


def make_engine(database_url: str):
    url = make_url(database_url)
    kwargs = {}
    if url.drivername in {"postgres", "postgresql", "postgresql+asyncpg"}:
        url = url.set(drivername="postgresql+asyncpg")
        sslmode = url.query.get("sslmode")
        url = url.difference_update_query(["sslmode", "channel_binding"])
        if sslmode:
            kwargs["connect_args"] = {"ssl": sslmode}
    engine = create_async_engine(url, pool_pre_ping=True, **kwargs)
    if url.drivername.startswith("sqlite"):

        @event.listens_for(engine.sync_engine, "connect")
        def foreign_keys(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def mutation_lock(app, db):
    # Attach, publish, delete and cleanup must serialize against the same lock.
    async with app.state.mutation_lock:
        if db.bind.dialect.name == "postgresql":
            await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": LOCK_ID})
        yield


def local_lock():
    return asyncio.Lock()
