from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, aware, own, require
from app.api.router import Router
from app.db.session import mutation_lock
from app.models import Content, ContentMediaLink, MediaAsset, utcnow
from app.schemas import ContentCreate, ContentRead, ContentStatus, ContentUpdate, Role

router = Router(prefix="/contents", tags=["Contents"])


async def attached_media(db, media_ids, principal):
    if not media_ids:
        return []
    rows = (await db.scalars(select(MediaAsset).where(MediaAsset.id.in_(media_ids)))).all()
    by_id = {row.id: row for row in rows}
    result = []
    for media_id in media_ids:
        row = own(by_id.get(media_id), principal, "uploader_id")
        if not row.upload_confirmed or row.is_cleaned:
            raise HTTPException(409, "Media is not confirmed or has been cleaned")
        result.append(row)
    return result


async def get_content(db, content_id, principal):
    record = await db.scalar(
        select(Content)
        .where(Content.id == content_id)
        .options(selectinload(Content.links).selectinload(ContentMediaLink.media))
    )
    return own(record, principal)


@router.get("", response_model=list[ContentRead], summary="List accessible content")
async def list_contents(
    db: DB,
    principal=Depends(require("contents:read")),
    status: ContentStatus | None = None,
    search: str = "",
    channel: Literal["facebook", "tiktok", "youtube"] | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
):
    """Filter content by status, title or a populated channel ID. Creators see only their own items. Paginate using offset/limit."""
    query = select(Content).options(selectinload(Content.links).selectinload(ContentMediaLink.media))
    if principal.user.role != Role.ADMIN:
        query = query.where(Content.author_id == principal.user.id)
    if status:
        query = query.where(Content.status == status)
    if search:
        query = query.where(Content.title.ilike("%" + search + "%"))
    if channel:
        field = {
            "facebook": Content.fb_post_id,
            "tiktok": Content.tiktok_post_id,
            "youtube": Content.youtube_post_id,
        }[channel]
        query = query.where(field != "")
    return (
        await db.scalars(query.order_by(Content.created_at.desc(), Content.id).offset(offset).limit(limit))
    ).all()


@router.post(
    "", response_model=ContentRead, status_code=201, summary="Create content with ordered attachments"
)
async def create_content(
    payload: ContentCreate, db: DB, request: Request, principal=Depends(require("contents:write"))
):
    """Create a draft or scheduled/published item. Channel IDs default to empty strings. Confirm uploads before attaching their IDs."""
    async with mutation_lock(request.app, db):
        media = await attached_media(db, payload.media_ids, principal)
        record = Content(
            **payload.model_dump(exclude={"media_ids"}),
            author_id=principal.user.id,
            published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
        )
        record.links = [ContentMediaLink(media=item, display_order=i) for i, item in enumerate(media)]
        db.add(record)
        await db.commit()
        return ContentRead.model_validate(record)


@router.get("/{content_id}", response_model=ContentRead, summary="Read a content item")
async def read_content(content_id: UUID, db: DB, principal=Depends(require("contents:read"))):
    """Return content and ordered media metadata within the caller's ownership boundary."""
    return await get_content(db, content_id, principal)


@router.patch("/{content_id}", response_model=ContentRead, summary="Partially update content or channel IDs")
@router.put("/{content_id}", response_model=ContentRead, summary="Update content fields and attachments")
async def update_content(
    content_id: UUID,
    payload: ContentUpdate,
    db: DB,
    request: Request,
    principal=Depends(require("contents:write")),
):
    """Merge provided fields. A transition to PUBLISHED stamps published_at; edits to published content retain it. Agents write social post IDs here after posting."""
    async with mutation_lock(request.app, db):
        record = await get_content(db, content_id, principal)
        data = payload.model_dump(exclude_unset=True)
        merged = {
            name: aware(getattr(record, name)) if name == "scheduled_at" else getattr(record, name)
            for name in ContentCreate.model_fields
            if name != "media_ids"
        }
        merged.update({name: value for name, value in data.items() if name != "media_ids"})
        try:
            ContentCreate(**merged)
        except ValueError:
            raise HTTPException(422, "Scheduled content requires an aware scheduled_at and valid fields")
        if "media_ids" in data:
            media = await attached_media(db, data.pop("media_ids"), principal)
            record.links.clear()
            await db.flush()
            record.links = [ContentMediaLink(media=item, display_order=i) for i, item in enumerate(media)]
        if data.get("status") == ContentStatus.PUBLISHED and record.status != ContentStatus.PUBLISHED:
            record.published_at = utcnow()
        for name, value in data.items():
            setattr(record, name, value)
        await db.commit()
        return ContentRead.model_validate(record)


@router.delete("/{content_id}", status_code=204, summary="Delete content while retaining media")
async def delete_content(
    content_id: UUID, db: DB, request: Request, principal=Depends(require("contents:write"))
):
    """Remove the content and attachment links. Physical media is managed separately."""
    async with mutation_lock(request.app, db):
        record = await get_content(db, content_id, principal)
        await db.delete(record)
        await db.commit()
    return Response(status_code=204)
