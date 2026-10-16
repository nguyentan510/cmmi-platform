import json
import secrets
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./cmmi.db"
    database_direct_url: str | None = None
    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48), min_length=32)
    token_expire_minutes: int = Field(default=60, ge=1, le=1440)
    scheduler_enabled: bool = True
    cors_origins: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://cmmi.trenux.site",
        "https://cmmi-frontend.onrender.com",
    ]
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_domain: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                try:
                    return json.loads(value)
                except Exception:
                    pass
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value  # type: ignore[return-value]

    @model_validator(mode="after")
    def production_requires_configuration(self):
        if self.environment == "production":
            if "secret_key" not in self.model_fields_set or not self.database_url.startswith("postgres"):
                raise ValueError("Production requires explicit SECRET_KEY and PostgreSQL DATABASE_URL")
            if not all(
                [
                    self.r2_endpoint_url,
                    self.r2_access_key_id,
                    self.r2_secret_access_key,
                    self.r2_bucket_name,
                    self.r2_public_domain,
                ]
            ):
                raise ValueError("Production requires R2 configuration")
        return self


@lru_cache
def get_settings():
    return Settings()
