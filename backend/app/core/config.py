import secrets
from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./cmmi.db"
    database_direct_url: str | None = None
    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48), min_length=32)
    token_expire_minutes: int = Field(default=60, ge=1, le=1440)
    scheduler_enabled: bool = True
    cors_origins: list[str] = ["http://localhost:5173"]
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_domain: str = ""

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
