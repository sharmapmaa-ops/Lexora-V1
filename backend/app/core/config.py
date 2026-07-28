"""
Central application configuration.

Every environment-driven value the app needs lives here, and *only* here.
Nothing else in the codebase should call ``os.environ.get(...)`` directly -
that scatters config across dozens of files and makes it impossible to see
what the app actually depends on. Import ``settings`` from this module
wherever a config value is needed.
"""
from functools import lru_cache
from typing import List

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Core ----
    ENVIRONMENT: str = Field(default="development")  # development | staging | production
    APP_NAME: str = Field(default="Lexora AI Solutions")
    API_V1_PREFIX: str = Field(default="/api/v1")
    DEBUG: bool = Field(default=False)

    # ---- Database (PostgreSQL only - no JSON-file fallback in this codebase) ----
    DATABASE_URL: PostgresDsn = Field(
        ...,
        description="postgresql+psycopg://user:password@host:5432/lexora",
    )
    DB_POOL_SIZE: int = Field(default=10)
    DB_MAX_OVERFLOW: int = Field(default=20)

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_db_driver(cls, v):
        """Render (and most other hosts: Railway, Supabase, Heroku, ...)
        hand out a plain `postgresql://...` URL with no driver suffix.
        SQLAlchemy then defaults to the `psycopg2` dialect, which isn't
        installed in this project (we use `psycopg[binary]`, i.e.
        psycopg v3) - that mismatch is what caused
        "ModuleNotFoundError: No module named 'psycopg2'" at boot.
        Rewriting the scheme here means pasting the host's URL in
        verbatim always works, regardless of whether `+psycopg` was
        remembered."""
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        if isinstance(v, str) and v.startswith("postgres://"):
            # Some providers (notably Heroku-style URLs) use the
            # `postgres://` scheme, which SQLAlchemy doesn't recognize
            # at all - not just the wrong driver.
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        return v

    # ---- Auth / security ----
    SECRET_KEY: str = Field(..., description="Used to sign JWTs - never commit a real value.")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 12)  # 12 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=14)

    # Stored as a plain comma-separated string (not List[str]) because
    # pydantic-settings attempts to JSON-decode any complex-typed env
    # var *before* field validators run, so a plain value like
    # "http://localhost:5173,http://localhost:3000" would fail to parse
    # as JSON. Use `cors_origins` (the parsed list) everywhere else.
    CORS_ORIGINS: str = Field(default="http://localhost:5173")

    # ---- Object storage (uploaded files, generated reports, invoices) ----
    STORAGE_BACKEND: str = Field(default="local")  # local | s3
    STORAGE_LOCAL_DIR: str = Field(default="./var/storage")
    S3_BUCKET: str = Field(default="")
    S3_REGION: str = Field(default="ap-south-1")
    AWS_ACCESS_KEY_ID: str = Field(default="")
    AWS_SECRET_ACCESS_KEY: str = Field(default="")

    # ---- LLM provider (lease abstraction / translation / OCR pipelines) ----
    LLM_PROVIDER: str = Field(default="openrouter")  # openrouter | openai
    OPENROUTER_API_KEY: str = Field(default="")
    OPENROUTER_MODEL: str = Field(default="openai/gpt-4o")
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_MODEL: str = Field(default="gpt-4o")

    # ---- Payments (Razorpay) ----
    RAZORPAY_KEY_ID: str = Field(default="")
    RAZORPAY_KEY_SECRET: str = Field(default="")

    # ---- Email (SMTP) ----
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=465)
    SMTP_USERNAME: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_SENDER_EMAIL: str = Field(default="")
    SMTP_USE_TLS: bool = Field(default=False)

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached singleton - Settings() re-reads env vars every call otherwise,
    which is wasteful and can produce subtly different config mid-request
    if the environment changes (it shouldn't, but caching removes the
    question entirely)."""
    return Settings()


settings = get_settings()
