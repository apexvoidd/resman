from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.config.settings import settings
from app.models.base import BaseModel


def get_async_db_url_and_args(raw_url: str) -> tuple[str, dict]:
    """
    Format DATABASE_URL for asyncpg compatibility:
    1. Converts postgres:// / postgresql:// to postgresql+asyncpg://
    2. Removes sslmode query parameter (asyncpg raises TypeError on sslmode kwarg)
    3. Converts sslmode parameter to connect_args={'ssl': True}
    """
    if not raw_url or raw_url.startswith("sqlite"):
        return raw_url, {}

    url = raw_url
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)

    sslmode = query_params.pop("sslmode", None)
    new_query = urlencode(query_params, doseq=True)

    cleaned_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

    connect_args = {}
    if sslmode:
        mode = sslmode[0] if isinstance(sslmode, list) else sslmode
        if mode in ("require", "prefer", "verify-ca", "verify-full", "true", "1"):
            connect_args["ssl"] = True

    return cleaned_url, connect_args


db_url, connect_args = get_async_db_url_and_args(settings.DATABASE_URL)

kwargs: dict = {"echo": settings.DB_ECHO, "future": True}
if connect_args:
    kwargs["connect_args"] = connect_args

if not db_url.startswith("sqlite"):
    kwargs["pool_size"] = settings.DB_POOL_SIZE
    kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW

engine = create_async_engine(db_url, **kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create tables and ensure missing columns are auto-added for local SQLite dev."""
    import app.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)

        def _sync_migrations(sync_conn):
            if settings.DATABASE_URL.startswith("sqlite"):
                from sqlalchemy import inspect, text
                inspector = inspect(sync_conn)

                # Ensure guest_sessions columns
                if "guest_sessions" in inspector.get_table_names():
                    cols = {c["name"] for c in inspector.get_columns("guest_sessions")}
                    if "is_locked" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN is_locked BOOLEAN DEFAULT 0 NOT NULL;"))
                    if "bill_requested_at" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN bill_requested_at DATETIME;"))
                    if "can_submit_review" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN can_submit_review BOOLEAN DEFAULT 0 NOT NULL;"))
                    if "expires_at" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN expires_at DATETIME NOT NULL DEFAULT (datetime('now', '+2 hours'));"))
                    if "occupied_at" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN occupied_at DATETIME;"))
                    if "verification_requested_at" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN verification_requested_at DATETIME;"))
                    if "rejection_reason" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN rejection_reason VARCHAR(500);"))
                    if "cooldown_until" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN cooldown_until DATETIME;"))
                    if "guest_email" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN guest_email VARCHAR(255);"))
                    if "guest_count" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN guest_count INTEGER;"))
                    if "reservation_expires_at" not in cols:
                        sync_conn.execute(text("ALTER TABLE guest_sessions ADD COLUMN reservation_expires_at DATETIME;"))

                # Ensure reviews columns
                if "reviews" in inspector.get_table_names():
                    cols = {c["name"] for c in inspector.get_columns("reviews")}
                    if "guest_session_id" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN guest_session_id CHAR(36);"))
                    if "menu_item_id" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN menu_item_id CHAR(36);"))
                    if "display_name" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN display_name VARCHAR(100);"))
                    if "manager_reply" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN manager_reply TEXT;"))
                    if "is_hidden" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN DEFAULT 0 NOT NULL;"))
                    if "is_verified" not in cols:
                        sync_conn.execute(text("ALTER TABLE reviews ADD COLUMN is_verified BOOLEAN DEFAULT 1 NOT NULL;"))

                # Ensure payments columns
                if "payments" in inspector.get_table_names():
                    cols = {c["name"] for c in inspector.get_columns("payments")}
                    if "razorpay_order_id" not in cols:
                        sync_conn.execute(text("ALTER TABLE payments ADD COLUMN razorpay_order_id VARCHAR(255);"))
                    if "razorpay_signature" not in cols:
                        sync_conn.execute(text("ALTER TABLE payments ADD COLUMN razorpay_signature VARCHAR(500);"))
                    if "cashier_user_id" not in cols:
                        sync_conn.execute(text("ALTER TABLE payments ADD COLUMN cashier_user_id CHAR(36);"))
                    if "notes" not in cols:
                        sync_conn.execute(text("ALTER TABLE payments ADD COLUMN notes TEXT;"))

        await conn.run_sync(_sync_migrations)

    try:
        from scripts.seed_roles import seed
        await seed()
    except Exception as e:
        print(f"Role seeding notice: {e}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
