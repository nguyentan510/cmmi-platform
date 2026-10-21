"""Public API contracts; the sole source for generated frontend types."""

from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID

from apscheduler.triggers.cron import CronTrigger
from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class Role(StrEnum):
    ADMIN = "ADMIN"
    CREATOR = "CREATOR"


class ContentStatus(StrEnum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class MediaType(StrEnum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


SCOPES = [
    "contents:read",
    "contents:write",
    "media:read",
    "media:write",
    "keys:read",
    "keys:write",
    "users:read",
    "users:write",
    "settings:read",
    "settings:write",
]
MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
}


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True, str_strip_whitespace=True)


class Login(Contract):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class Token(Contract):
    access_token: str
    token_type: str = "bearer"


class UserCreate(Contract):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Role = Role.CREATOR


class UserUpdate(Contract):
    is_active: bool | None = None
    role: Role | None = None
    password: str | None = Field(default=None, min_length=12, max_length=128)

    @model_validator(mode="after")
    def reject_nulls(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Explicit null is not permitted")
        return self


class UserRead(Contract):
    id: UUID
    email: EmailStr
    role: Role
    is_active: bool
    created_at: datetime


class KeyCreate(Contract):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[str] = Field(default_factory=lambda: SCOPES[:4].copy(), min_length=1)
    expires_at: AwareDatetime | None = None

    @field_validator("scopes")
    @classmethod
    def known_scopes(cls, value):
        if len(set(value)) != len(value) or not set(value) <= set(SCOPES):
            raise ValueError("Unknown or duplicate API key scope")
        return value

    @field_validator("expires_at")
    @classmethod
    def future_expiry(cls, value):
        if value and value <= datetime.now(timezone.utc):
            raise ValueError("Expiry must be in the future")
        return value


class KeyRead(Contract):
    id: UUID
    user_id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    expires_at: datetime | None
    last_used_at: datetime | None
    is_active: bool


class KeyCreated(KeyRead):
    key: str = Field(description="Secret returned only at creation; copy it now.")


class MediaRead(Contract):
    id: UUID
    uploader_id: UUID
    file_name: str
    public_url: str
    media_type: MediaType
    mime_type: str
    file_size_bytes: int
    is_cleaned: bool
    upload_confirmed: bool
    created_at: datetime


class UploadRequest(Contract):
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str
    file_size_bytes: int = Field(gt=0, le=5_000_000_000)

    @field_validator("mime_type")
    @classmethod
    def safe_media(cls, value):
        if value not in MIME_TYPES:
            raise ValueError("Unsupported image or video MIME type")
        return value


class UploadResponse(Contract):
    media: MediaRead
    upload_url: str
    expires_in: int = 900
    headers: dict[str, str]


class MediaUploadFromUrl(Contract):
    url: str = Field(min_length=1, max_length=2048, description="Public HTTP/HTTPS URL of image or video to download")
    file_name: str | None = Field(default=None, max_length=255, description="Optional custom filename with extension")



class ContentCreate(Contract):
    title: str = Field(min_length=1, max_length=255)
    body: str = ""
    status: ContentStatus = ContentStatus.DRAFT
    scheduled_at: AwareDatetime | None = None
    fb_post_id: str = Field(default="", max_length=2048)
    tiktok_post_id: str = Field(default="", max_length=2048)
    youtube_post_id: str = Field(default="", max_length=2048)
    media_ids: list[UUID] = Field(default_factory=list, max_length=100)

    @field_validator("media_ids")
    @classmethod
    def unique_media(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Duplicate media IDs")
        return value

    @model_validator(mode="after")
    def scheduled_date_required(self):
        if self.status == ContentStatus.SCHEDULED and self.scheduled_at is None:
            raise ValueError("Scheduled content requires scheduled_at")
        return self


class ContentUpdate(Contract):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = None
    status: ContentStatus | None = None
    scheduled_at: AwareDatetime | None = None
    fb_post_id: str | None = Field(default=None, max_length=2048)
    tiktok_post_id: str | None = Field(default=None, max_length=2048)
    youtube_post_id: str | None = Field(default=None, max_length=2048)
    media_ids: list[UUID] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_patch(self):
        for key in self.model_fields_set - {"scheduled_at"}:
            if getattr(self, key) is None:
                raise ValueError(f"{key} cannot be null")
        if self.media_ids is not None and len(self.media_ids) != len(set(self.media_ids)):
            raise ValueError("Duplicate media IDs")
        return self


class ContentRead(Contract):
    id: UUID
    author_id: UUID
    title: str
    body: str
    status: ContentStatus
    scheduled_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    fb_post_id: str
    tiktok_post_id: str
    youtube_post_id: str
    media_assets: list[MediaRead]


class SettingUpdate(Contract):
    auto_clean_media: bool = True
    retention_days: int = Field(default=7, ge=1, le=365)
    cron_expression: str = "0 2 * * *"

    @field_validator("cron_expression")
    @classmethod
    def valid_cron(cls, value):
        CronTrigger.from_crontab(value, timezone="UTC")
        return value


class SettingRead(SettingUpdate):
    updated_at: datetime
    last_run_at: datetime | None
    last_deleted_count: int
    active_storage_bytes: int
    active_media_count: int


class CleanupResult(Contract):
    deleted_count: int = 0
    failed_count: int = 0
    skipped: bool = False


class Health(Contract):
    status: str
