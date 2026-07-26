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
    PUBLIC_BASE_URL: str = ""


    # Security
    SECRET_KEY: str = "default-insecure-secret-key-change-in-production"
    ALLOWED_HOSTS: str | list[str] = ["localhost", "127.0.0.1", "0.0.0.0", "test", "testserver", "*"]
    CORS_ORIGINS: str | list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/restaurant_db"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Cache (Redis / Upstash)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Supabase Storage Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_BUCKET_NAME: str = "uploads"

    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Email via Resend
    RESEND_API_KEY: str = ""

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
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(i).strip().rstrip("/") for i in parsed if str(i).strip()]
                except Exception:
                    pass
                # Fallback stripping brackets
                v_trimmed = v_trimmed[1:-1]
            return [
                i.strip().strip("'\"").rstrip("/")
                for i in v_trimmed.split(",")
                if i.strip().strip("'\"")
            ]
        elif isinstance(v, list):
            return [str(i).strip().rstrip("/") for i in v if str(i).strip()]
        return v


settings = Settings()
