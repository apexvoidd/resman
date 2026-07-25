from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.config.settings import settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.middleware.cors import setup_cors
from app.middleware.rate_limit import setup_rate_limiter
from app.middleware.security_headers import SecurityHeadersMiddleware

# Setup structured logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks (e.g. cache connection, monitoring initialization)
    yield
    # Shutdown tasks (e.g. database pool cleanup)


def create_app() -> FastAPI:
    """Application factory for FastAPI."""
    app = FastAPI(
        title=settings.APP_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
        docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
        redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Trusted Hosts Middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )

    # Security Headers Middleware
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS Setup
    setup_cors(app)

    # Rate Limiter Setup
    setup_rate_limiter(app)

    # Register Global Exception Handlers
    register_error_handlers(app)

    # Include Routers (Available at root / and /health as well as /api/v1)
    app.include_router(api_router)
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
