from datetime import timedelta
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import aliased

from app.db.session import mutation_lock
from app.models import Content, ContentMediaLink, MediaAsset, SystemSetting, utcnow
from app.schemas import CleanupResult, ContentStatus

log = logging.getLogger(__name__)


async def setting_record(db):
    record = await db.get(SystemSetting, 1)
    if record is None:
        record = SystemSetting(id=1)
        db.add(record)
        await db.flush()
    return record


async def clean_media(app) -> CleanupResult:
    result = CleanupResult()
    async with app.state.sessions() as db:
        async with mutation_lock(app, db):
            setting = await setting_record(db)
            if not setting.auto_clean_media:
                await db.commit()
                return CleanupResult(skipped=True)
            now = utcnow()
            cutoff = now - timedelta(days=setting.retention_days)
            linked_content = aliased(Content)
            eligible = exists(
                select(ContentMediaLink.content_id)
                .join(linked_content, linked_content.id == ContentMediaLink.content_id)
                .where(
                    ContentMediaLink.media_id == MediaAsset.id,
                    linked_content.status == ContentStatus.PUBLISHED,
                    linked_content.published_at <= cutoff,
                )
            )
            protected = exists(
                select(ContentMediaLink.content_id)
                .join(linked_content, linked_content.id == ContentMediaLink.content_id)
                .where(
                    ContentMediaLink.media_id == MediaAsset.id,
                    or_(
                        linked_content.status != ContentStatus.PUBLISHED,
                        linked_content.published_at.is_(None),
                        linked_content.published_at > cutoff,
                    ),
                )
            )
            cursor = None
            while True:
                query = select(MediaAsset).where(
                    MediaAsset.is_cleaned.is_(False),
                    MediaAsset.upload_confirmed.is_(True),
                    eligible,
                    ~protected,
                )
                if cursor is not None:
                    query = query.where(MediaAsset.id > cursor)
                rows = (await db.scalars(query.order_by(MediaAsset.id).limit(1000))).all()
                if not rows:
                    break
                cursor = rows[-1].id
                try:
                    deleted = await app.state.storage.delete([item.r2_object_key for item in rows])
                except Exception:
                    log.exception("R2 cleanup batch failed; metadata remains retryable")
                    deleted = set()
                for item in rows:
                    if item.r2_object_key in deleted:
                        item.is_cleaned, item.public_url = True, ""
                        result.deleted_count += 1
                    else:
                        result.failed_count += 1
                await db.flush()
            setting.last_run_at = now
            setting.last_deleted_count = result.deleted_count
            await db.commit()
    return result


def configure_scheduler(app, cron_expression: str):
    scheduler = getattr(app.state, "scheduler", None)
    if scheduler is not None:
        scheduler.add_job(
            clean_media,
            trigger=CronTrigger.from_crontab(cron_expression, timezone="UTC"),
            args=[app],
            id="media-cleanup",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
        )


async def start_scheduler(app):
    async with app.state.sessions() as db:
        async with mutation_lock(app, db):
            setting = await setting_record(db)
            cron = setting.cron_expression
            await db.commit()
    app.state.scheduler = AsyncIOScheduler(timezone="UTC")
    configure_scheduler(app, cron)
    app.state.scheduler.start()
