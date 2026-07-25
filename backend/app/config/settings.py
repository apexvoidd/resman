from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # Core Application Settings
    APP_NAME: str = "Smart Restaurant Management System"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security
    SECRET_KEY: str = "default-insecure-secret-key-change-in-production"
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1", "0.0.0.0", "test", "*"]
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/restaurant_db"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Cache (Redis / Upstash)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Cloudflare R2 Storage Placeholder Config
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_DOMAIN: str = ""

    # Realtime Placeholder Config (Pusher / Ably)
    PUSHER_APP_ID: str = ""
    PUSHER_KEY: str = ""
    PUSHER_SECRET: str = ""
    PUSHER_CLUSTER: str = "mt1"

    # Monitoring (Sentry)
    SENTRY_DSN: str = ""

    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""  # sk_test_xxx
    CLERK_PUBLISHABLE_KEY: str = ""  # pk_test_xxx
    CLERK_JWKS_URL: str = ""  # e.g. https://xxx.clerk.accounts.dev/.well-known/jwks.json
    CLERK_ISSUER: str = ""  # e.g. https://xxx.clerk.accounts.dev

    # Logging (Better Stack / Structured)
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    @field_validator("CORS_ORIGINS", "ALLOWED_HOSTS", mode="before")
    @classmethod
    def assemble_list(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()
