from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db.types import UTCDateTime as DateTime

from app.schemas import ContentStatus, MediaType, Role


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), default=Role.CREATOR)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    key_prefix: Mapped[str] = mapped_column(String(32))
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scopes: Mapped[list[str]] = mapped_column(JSON().with_variant(ARRAY(String), "postgresql"))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class MediaAsset(Base):
    __tablename__ = "media_assets"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    uploader_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    r2_object_key: Mapped[str] = mapped_column(String(1024), unique=True)
    public_url: Mapped[str] = mapped_column(Text, default="")
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    is_cleaned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    upload_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Content(Base):
    __tablename__ = "contents"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ContentStatus] = mapped_column(
        Enum(ContentStatus, name="content_status"), default=ContentStatus.DRAFT, index=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    fb_post_id: Mapped[str] = mapped_column(String(2048), default="", server_default="")
    tiktok_post_id: Mapped[str] = mapped_column(String(2048), default="", server_default="")
    youtube_post_id: Mapped[str] = mapped_column(String(2048), default="", server_default="")
    links: Mapped[list["ContentMediaLink"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ContentMediaLink.display_order"
    )

    @property
    def media_assets(self):
        return [link.media for link in self.links]


class ContentMediaLink(Base):
    __tablename__ = "content_media_links"
    content_id: Mapped[UUID] = mapped_column(ForeignKey("contents.id", ondelete="CASCADE"), primary_key=True)
    media_id: Mapped[UUID] = mapped_column(ForeignKey("media_assets.id"), primary_key=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    media: Mapped[MediaAsset] = relationship(lazy="selectin")


class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="singleton_settings"),
        CheckConstraint("retention_days >= 1 AND retention_days <= 365", name="retention_range"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    auto_clean_media: Mapped[bool] = mapped_column(Boolean, default=True)
    retention_days: Mapped[int] = mapped_column(Integer, default=7)
    cron_expression: Mapped[str] = mapped_column(String(100), default="0 2 * * *")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_deleted_count: Mapped[int] = mapped_column(Integer, default=0)
