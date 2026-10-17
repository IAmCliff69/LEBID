from pydantic import BaseModel
from typing import Any, Literal


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

class AiAction(BaseModel):
    """
    A change the AI proposes. Nothing happens until the student presses Apply.
    The details in `payload` are the same fields the normal forms send.
    """
    key: str                                   # unique id for this card
    action: Literal["create", "update", "delete"]
    entity: Literal["study_session", "task", "assignment", "exam", "event"]
    id: str | None = None                      # the item to change (update/delete)
    title: str                                 # short card title
    description: str                           # why the AI suggests it
    target: str | None = None                  # the REAL item, read from the database
    payload: dict[str, Any] = {}               # new details (create/update)
    previous: dict[str, Any] | None = None     # what Undo needs
class ChatResponse(BaseModel):
    """The AI assistant's response."""
    message: str
    recommendations: list[Recommendation] = []
    insights: list[str] = []
    actions: list[AiAction] = []
    action_warnings: list[str] = []