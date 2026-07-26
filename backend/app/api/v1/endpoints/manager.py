"""Manager Dashboard endpoints."""

from typing import Any, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.manager import (
    BroadcastRequestPayload,
    ManagerOverviewResponse,
    RecipeProfitabilityItem,
)
from app.services import manager as manager_service

router = APIRouter(prefix="/manager", tags=["Manager Hub & Analytics"])


@router.get(
    "/overview",
    response_model=ManagerOverviewResponse,
    status_code=status.HTTP_200_OK,
)
async def get_manager_overview(
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await manager_service.get_manager_overview(db)


@router.get(
    "/recipe-profitability",
    response_model=List[RecipeProfitabilityItem],
    status_code=status.HTTP_200_OK,
)
async def get_recipe_profitability(
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await manager_service.get_recipe_profitability_analysis(db)


@router.post("/broadcast", status_code=status.HTTP_200_OK)
async def broadcast_announcement(
    payload: BroadcastRequestPayload,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    count = await manager_service.broadcast_manager_announcement(
        db, payload.title, payload.message, payload.priority
    )
    return {"message": f"Announcement sent to {count} staff channels."}


@router.post("/bulk-table-reset", status_code=status.HTTP_200_OK)
async def bulk_table_reset(
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    count = await manager_service.bulk_reset_tables(db)
    return {"message": f"Reset {count} tables to available.", "count": count}
