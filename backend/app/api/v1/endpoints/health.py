from fastapi import APIRouter

from app.config.settings import settings

router = APIRouter()


@router.get("/health", status_code=200)
async def get_health():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "0.1.0",
    }
