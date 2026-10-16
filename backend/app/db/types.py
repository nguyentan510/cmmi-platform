from datetime import timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """Keep UTC on SQLite roundtrips as well as PostgreSQL timestamptz."""

    impl = DateTime
    cache_ok = True

    def __init__(self, timezone=True):
        super().__init__(timezone=timezone)

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("Datetime must include timezone")
            return value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return (
                value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
            )
        return value
