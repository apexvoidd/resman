from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings


def setup_cors(app: FastAPI) -> None:
    """Configures CORS settings for the application.

    Supports explicit origins, wildcards, local dev ports, Vercel deployments, and credentialed requests.
    """
    configured_origins = (
        settings.CORS_ORIGINS
        if isinstance(settings.CORS_ORIGINS, list)
        else [settings.CORS_ORIGINS]
    )

    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://resman-aqqx.vercel.app",
    ]

    origins_set = set()
    for origin in list(configured_origins) + default_origins:
        if origin:
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned != "*":
                origins_set.add(cleaned)

    origins = list(origins_set)

    # Regex allows any localhost, 127.0.0.1, Vercel deployment (*.vercel.app), or Render domain
    allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?|https?://.*\.vercel\.app|https?://.*\.onrender\.com"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=600,
    )
