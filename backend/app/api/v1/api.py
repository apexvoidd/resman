from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    billing,
    guest,
    health,
    inventory,
    kds,
    manager,
    menu,
    order,
    recipe,
    review,
    root,
    settings,
    staff,
    table,
)

api_router = APIRouter()

# Root & Health Endpoints
api_router.include_router(root.router, tags=["Root"])
api_router.include_router(health.router, tags=["Health"])

# Auth Endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Settings Endpoints
api_router.include_router(settings.router)

# Staff Management Endpoints
api_router.include_router(staff.router)

# Table Management Endpoints
api_router.include_router(table.router)

# Guest Session & Entrance QR Endpoints
api_router.include_router(guest.router, prefix="/guest", tags=["Guest & Entrance QR"])

# Menu & Category Management Endpoints
api_router.include_router(menu.router)

# Customer Cart & Ordering Endpoints
api_router.include_router(order.router)

# Kitchen Display System (KDS) Endpoints
api_router.include_router(kds.router)

# Inventory Management Endpoints
api_router.include_router(inventory.router)

# Recipe Management Endpoints (Dual Mount for /recipes and /recipe)
api_router.include_router(recipe.router, prefix="/recipes", tags=["Recipe Management"])
api_router.include_router(recipe.router, prefix="/recipe", tags=["Recipe Management (Alias)"])

# Manager Hub & Analytics Endpoints
api_router.include_router(manager.router)

# Billing & Payments Endpoints
api_router.include_router(billing.router, prefix="/billing", tags=["Billing & Payments"])

# Customer Reviews Endpoints
api_router.include_router(review.router)






