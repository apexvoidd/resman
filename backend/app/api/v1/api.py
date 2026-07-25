from fastapi import APIRouter

from app.api.v1.endpoints import auth, guest, health, root, settings, staff, table

api_router = APIRouter()

# Root & Health Endpoints
api_router.include_router(root.router, tags=["Root"])
api_router.include_router(health.router, tags=["Health"])

# Auth Endpoints
api_router.include_router(auth.router, tags=["Auth"])

# Settings Endpoints
api_router.include_router(settings.router)

# Staff Management Endpoints
api_router.include_router(staff.router)

# Table Management Endpoints
api_router.include_router(table.router)

# Guest Session & Entrance QR Endpoints
api_router.include_router(guest.router, prefix="/guest", tags=["Guest & Entrance QR"])



