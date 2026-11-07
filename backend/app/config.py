from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# One .env at the repo root is shared with the frontend (see .env.example).
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Backend settings. Every field is optional in Phase 1: the mock endpoints need no credentials."""

    model_config = SettingsConfigDict(
        env_file=ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",  # the shared .env also holds frontend-only variables
    )

    frontend_origin: str = Field(default="http://localhost:3000")

    # Not used by the mock endpoints yet. They become required when the backend
    # starts writing check results to Supabase and verifying user JWTs.
    supabase_url: str | None = Field(
        default=None, validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    )
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
