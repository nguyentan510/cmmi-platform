from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.contents import router as contents_router
from app.api.v1.media import router as media_router
from app.api.v1.settings import router as settings_router
from app.api.v1.tools_agent import router as tools_router
from app.api.v1.docs_ai import router as docs_router

import re
from app.core.config import Settings, get_settings
from app.core.r2_client import R2Storage
from app.db.session import local_lock, make_engine, session_factory
from app.tasks.media_cleaner import start_scheduler


class NormalizePathMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if "//" in path:
                scope["path"] = re.sub(r"/+", "/", path)
        await self.app(scope, receive, send)


@asynccontextmanager
async def lifespan(app):
    try:
        if app.state.settings.scheduler_enabled:
            await start_scheduler(app)
        yield
    finally:
        scheduler = getattr(app.state, "scheduler", None)
        if scheduler and scheduler.running:
            scheduler.shutdown(wait=False)
        await app.state.engine.dispose()


def create_app(settings: Settings | None = None):
    settings = settings or get_settings()
    app = FastAPI(
        title="CMMI API",
        version="0.1.0",
        docs_url=None,
        redoc_url="/redoc",
        description="Content and media management for creators, administrators and automation agents.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.sessions = session_factory(app.state.engine)
    app.state.mutation_lock = local_lock()
    app.state.storage = R2Storage(settings)
    app.add_middleware(NormalizePathMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(contents_router, prefix="/api/v1")
    app.include_router(media_router, prefix="/api/v1")
    app.include_router(settings_router, prefix="/api/v1")
    app.include_router(tools_router, prefix="/api/v1")
    app.include_router(docs_router)

    return app


app = create_app()
