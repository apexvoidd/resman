"""
AI Manager Assistant API Endpoints.
"""

from typing import Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.staff import User
from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services import ai_assistant as ai_service

router = APIRouter(prefix="/manager/ai", tags=["AI Manager Assistant"])


@router.post(
    "/chat",
    response_model=AIChatResponse,
    status_code=status.HTTP_200_OK,
)
async def chat_with_ai_assistant(
    payload: AIChatRequest,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Process a manager operational query using live context and NVIDIA NIM LLM."""
    return await ai_service.process_ai_chat(
        db=db,
        message=payload.message,
        session_id=payload.session_id,
        history=payload.history,
    )


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
)
async def stream_chat_with_ai_assistant(
    payload: AIChatRequest,
    _: User = Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Stream manager query response as Server-Sent Events (SSE)."""
    return StreamingResponse(
        ai_service.process_ai_chat_stream(
            db=db,
            message=payload.message,
            session_id=payload.session_id,
            history=payload.history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/suggestions",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
)
async def get_ai_starter_suggestions(
    _: User = Depends(require_role(["manager", "admin"])),
) -> Any:
    """Return starter question suggestions for the Manager Dashboard AI Assistant."""
    return [
        "Give me a complete summary of today's restaurant performance",
        "Which ingredients are currently running low on stock?",
        "What is our current table occupancy rate?",
        "Show active kitchen orders and prep status",
        "Which menu recipes have the highest and lowest profit margins?",
        "What are today's top-selling dishes by revenue?",
    ]
