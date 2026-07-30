"""
Pydantic schemas for AI Manager Assistant.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant' or 'system'")
    content: str = Field(..., description="Message text content")


class AIChatRequest(BaseModel):
    message: str = Field(..., description="User query for the AI Manager Assistant")
    session_id: Optional[str] = Field(None, description="Optional conversation session ID")
    history: Optional[list[AIChatMessage]] = Field(default_factory=list, description="Recent conversation history")


class AIChatResponse(BaseModel):
    reply: str = Field(..., description="AI Assistant reply")
    session_id: str = Field(..., description="Session identifier")
    suggested_questions: list[str] = Field(default_factory=list, description="Suggested follow-up questions")
    context_summary: Optional[dict[str, Any]] = Field(None, description="Summary of live data context used")
