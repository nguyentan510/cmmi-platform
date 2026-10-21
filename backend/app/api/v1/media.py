import logging
import mimetypes
from typing import Annotated
from uuid import UUID, uuid4

import httpx
from fastapi import Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import select

from app.api.deps import DB, own, require
from app.api.router import Router
from app.db.session import mutation_lock
from app.models import ContentMediaLink, MediaAsset
from app.schemas import MIME_TYPES, MediaRead, MediaType, MediaUploadFromUrl, Role, UploadRequest, UploadResponse


router = Router(prefix="/media", tags=["Media"])
log = logging.getLogger(__name__)


@router.get("", response_model=list[MediaRead], summary="List media and retained cleanup metadata")
async def list_media(
    db: DB,
    principal=Depends(require("media:read")),
    is_cleaned: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
):
    """Creators see their files; admins see the whole library. Cleaned records have no public URL."""
    query = select(MediaAsset)
    if principal.user.role != Role.ADMIN:
        query = query.where(MediaAsset.uploader_id == principal.user.id)
    if is_cleaned is not None:
        query = query.where(MediaAsset.is_cleaned == is_cleaned)
    return (
        await db.scalars(
            query.order_by(MediaAsset.created_at.desc(), MediaAsset.id).offset(offset).limit(limit)
        )
    ).all()


@router.post(
    "/upload-request",
    response_model=UploadResponse,
    status_code=201,
    summary="Reserve media and get a signed R2 PUT URL",
)
async def request_upload(
    payload: UploadRequest, db: DB, request: Request, principal=Depends(require("media:write"))
):
    """Reserve an upload. PUT bytes directly to upload_url using the returned Content-Type header within 900 seconds, then call confirm."""
    media_id = uuid4()
    key = f"{principal.user.id}/{media_id}"
    try:
        url = await request.app.state.storage.presign("staging/" + key, payload.mime_type)
    except Exception:
        raise HTTPException(502, "Unable to sign upload; check R2 configuration")
    record = MediaAsset(
        id=media_id,
        uploader_id=principal.user.id,
        r2_object_key=key,
        **payload.model_dump(),
        media_type=MediaType.IMAGE if payload.mime_type.startswith("image/") else MediaType.VIDEO,
    )
    db.add(record)
    await db.commit()
    return UploadResponse(
        media=MediaRead.model_validate(record), upload_url=url, headers={"Content-Type": record.mime_type}
    )


@router.post(
    "/upload-from-url",
    response_model=MediaRead,
    status_code=201,
    summary="Download media from URL and ingest directly into R2",
)
async def upload_from_url(
    payload: MediaUploadFromUrl, db: DB, request: Request, principal=Depends(require("media:write"))
):
    """Download an image or video from an external URL and store it directly in R2."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(str(payload.url))
            if resp.status_code != 200:
                raise HTTPException(400, f"Failed to download media from URL (status {resp.status_code})")
            content = resp.content
            mime_type = resp.headers.get("content-type", "").split(";")[0].strip().lower()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Network error downloading media: {exc}")

    if mime_type not in MIME_TYPES:
        url_path = str(payload.url).split("?")[0]
        guessed, _ = mimetypes.guess_type(url_path)
        if guessed and guessed in MIME_TYPES:
            mime_type = guessed

    if mime_type not in MIME_TYPES:
        raise HTTPException(422, f"Unsupported image or video MIME type: {mime_type}")

    file_size_bytes = len(content)
    if file_size_bytes == 0:
        raise HTTPException(422, "Downloaded file is empty")
    if file_size_bytes > 100_000_000:
        raise HTTPException(422, "File size exceeds 100MB limit for URL upload")

    file_name = payload.file_name
    if not file_name:
        url_file = str(payload.url).split("?")[0].rstrip("/").split("/")[-1]
        file_name = url_file if url_file and "." in url_file else f"media_{uuid4().hex[:8]}"
        if "." not in file_name:
            ext = mimetypes.guess_extension(mime_type) or ".bin"
            file_name += ext

    media_id = uuid4()
    key = f"{principal.user.id}/{media_id}"
    try:
        await request.app.state.storage.put(key, content, mime_type)
    except Exception:
        raise HTTPException(502, "Unable to save media to R2 storage")

    record = MediaAsset(
        id=media_id,
        uploader_id=principal.user.id,
        r2_object_key=key,
        file_name=file_name,
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
        media_type=MediaType.IMAGE if mime_type.startswith("image/") else MediaType.VIDEO,
        upload_confirmed=True,
        public_url=request.app.state.settings.r2_public_domain.rstrip("/") + "/" + key,
    )
    db.add(record)
    await db.commit()
    return MediaRead.model_validate(record)


@router.post(
    "/upload-direct",
    response_model=MediaRead,
    status_code=201,
    summary="Upload media directly via multipart/form-data",
)
async def upload_direct(
    file: UploadFile = File(...),
    db: DB = None,
    request: Request = None,
    principal=Depends(require("media:write")),
):
    """Direct 1-step multipart form-data upload for AI bots and automation clients."""
    mime_type = file.content_type.split(";")[0].strip().lower() if file.content_type else ""
    if mime_type not in MIME_TYPES:
        guessed, _ = mimetypes.guess_type(file.filename or "")
        if guessed and guessed in MIME_TYPES:
            mime_type = guessed

    if mime_type not in MIME_TYPES:
        raise HTTPException(422, f"Unsupported image or video MIME type: {mime_type}")

    content = await file.read()
    file_size_bytes = len(content)
    if file_size_bytes == 0:
        raise HTTPException(422, "Uploaded file is empty")
    if file_size_bytes > 100_000_000:
        raise HTTPException(422, "File size exceeds 100MB limit for direct upload")

    media_id = uuid4()
    key = f"{principal.user.id}/{media_id}"
    try:
        await request.app.state.storage.put(key, content, mime_type)
    except Exception:
        raise HTTPException(502, "Unable to save media to R2 storage")

    record = MediaAsset(
        id=media_id,
        uploader_id=principal.user.id,
        r2_object_key=key,
        file_name=file.filename or f"media_{media_id}",
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
        media_type=MediaType.IMAGE if mime_type.startswith("image/") else MediaType.VIDEO,
        upload_confirmed=True,
        public_url=request.app.state.settings.r2_public_domain.rstrip("/") + "/" + key,
    )
    db.add(record)
    await db.commit()
    return MediaRead.model_validate(record)


@router.post("/{media_id}/confirm", response_model=MediaRead, summary="Verify and confirm an R2 upload")
async def confirm_upload(media_id: UUID, db: DB, request: Request, principal=Depends(require("media:write"))):
    """HEAD the object and verify its MIME type and byte length. Only confirmed media can be attached to content."""
    async with mutation_lock(request.app, db):
        record = own(await db.get(MediaAsset, media_id), principal, "uploader_id")
        if record.is_cleaned:
            raise HTTPException(409, "Media has already been cleaned")
        if record.upload_confirmed:
            return MediaRead.model_validate(record)
        source_key = "staging/" + record.r2_object_key
        try:
            metadata = await request.app.state.storage.head(source_key)
        except Exception:
            raise HTTPException(409, "Uploaded object is unavailable; retry after PUT completes")
        if (
            metadata.get("ContentLength") != record.file_size_bytes
            or metadata.get("ContentType") != record.mime_type
        ):
            raise HTTPException(409, "Uploaded object size or MIME does not match reservation")
        if not metadata.get("ETag"):
            raise HTTPException(409, "Uploaded object has no ETag; cannot safely confirm")
        try:
            await request.app.state.storage.promote(source_key, record.r2_object_key, metadata["ETag"])
        except Exception:
            raise HTTPException(502, "Unable to finalize upload; retry confirmation")
        record.upload_confirmed = True
        record.public_url = (
            request.app.state.settings.r2_public_domain.rstrip("/") + "/" + record.r2_object_key
        )
        await db.commit()
        try:
            await request.app.state.storage.delete([source_key])
        except Exception:
            log.warning("Staging removal failed; the staging lifecycle rule must expire it")
        return MediaRead.model_validate(record)


@router.delete("/{media_id}", status_code=204, summary="Delete unreferenced media from R2")
async def delete_media(media_id: UUID, db: DB, request: Request, principal=Depends(require("media:write"))):
    """Delete an owned, unattached object; retain its metadata as cleaned. Referenced objects must be detached first."""
    async with mutation_lock(request.app, db):
        record = own(await db.get(MediaAsset, media_id), principal, "uploader_id")
        if not record.is_cleaned:
            if await db.scalar(
                select(ContentMediaLink.content_id).where(ContentMediaLink.media_id == media_id).limit(1)
            ):
                raise HTTPException(409, "Media is attached to content; detach it first")
            try:
                keys = (
                    [record.r2_object_key]
                    if record.upload_confirmed
                    else [record.r2_object_key, "staging/" + record.r2_object_key]
                )
                deleted = await request.app.state.storage.delete(keys)
            except Exception:
                raise HTTPException(502, "R2 deletion failed; metadata unchanged")
            if not set(keys) <= deleted:
                raise HTTPException(502, "R2 did not confirm deletion; metadata unchanged")
            record.is_cleaned, record.public_url = True, ""
            await db.commit()
    return Response(status_code=204)
