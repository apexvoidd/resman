from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import settings

from app.models.base import BaseModel

kwargs = {"echo": settings.DB_ECHO, "future": True}
if not settings.DATABASE_URL.startswith("sqlite"):
    kwargs["pool_size"] = settings.DB_POOL_SIZE
    kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW

engine = create_async_engine(settings.DATABASE_URL, **kwargs)

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


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
