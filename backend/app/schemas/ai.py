from pydantic import BaseModel
from typing import Any


class ChatRequest(BaseModel):
    """A message from the student to the AI assistant."""
    message: str
    conversation_history: list[dict] | None = None


class Recommendation(BaseModel):
    """A single AI recommendation."""
    type: str
    title: str
    description: str
    data: dict[str, Any] = {}


class ChatResponse(BaseModel):
    """The AI assistant's response."""
    message: str
    recommendations: list[Recommendation] = []
    insights: list[str] = []