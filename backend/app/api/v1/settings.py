from fastapi import Depends, Request
from sqlalchemy import func, select

from app.api.deps import DB, require
from app.api.router import Router
from app.db.session import mutation_lock
from app.models import MediaAsset
from app.schemas import CleanupResult, SettingRead, SettingUpdate
from app.tasks.media_cleaner import clean_media, configure_scheduler, setting_record

router = Router(prefix="/settings/cleanup", tags=["Cleanup settings"])


async def settings_read(db, record):
    total, count = (
        await db.execute(
            select(func.coalesce(func.sum(MediaAsset.file_size_bytes), 0), func.count(MediaAsset.id)).where(
                MediaAsset.is_cleaned.is_(False), MediaAsset.upload_confirmed.is_(True)
            )
        )
    ).one()
    return SettingRead(
        auto_clean_media=record.auto_clean_media,
        retention_days=record.retention_days,
        cron_expression=record.cron_expression,
        updated_at=record.updated_at,
        last_run_at=record.last_run_at,
        last_deleted_count=record.last_deleted_count,
        active_storage_bytes=total,
        active_media_count=count,
    )


@router.get("", response_model=SettingRead, summary="Read cleanup configuration and storage totals (admin)")
async def get_settings(db: DB, request: Request, principal=Depends(require("settings:read", admin=True))):
    """Read retention, UTC cron, last-run statistics and confirmed active bytes. These totals come from registered metadata, not an R2 bucket inventory."""
    async with mutation_lock(request.app, db):
        record = await setting_record(db)
        result = await settings_read(db, record)
        await db.commit()
        return result


@router.put("", response_model=SettingRead, summary="Configure cleanup and reschedule cron (admin)")
async def update_settings(
    payload: SettingUpdate, db: DB, request: Request, principal=Depends(require("settings:write", admin=True))
):
    """Set retention 1..365 days, enable/disable deletion and update a five-field cron expression in UTC. Defaults: 7 days, 02:00 UTC."""
    async with mutation_lock(request.app, db):
        record = await setting_record(db)
        for name, value in payload.model_dump().items():
            setattr(record, name, value)
        await db.flush()
        result = await settings_read(db, record)
        await db.commit()
        configure_scheduler(request.app, record.cron_expression)
        return result


@router.post("/trigger", response_model=CleanupResult, summary="Run media retention cleanup now (admin)")
async def trigger_cleanup(request: Request, principal=Depends(require("settings:write", admin=True))):
    """Run the same retention policy as cron. Disabled cleanup is skipped. Shared media is deleted only when every reference is an expired publication; partial R2 failures remain retryable."""
    return await clean_media(request.app)
