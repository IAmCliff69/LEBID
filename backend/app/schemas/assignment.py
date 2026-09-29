from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PRIORITY_VALUES = Literal["low", "medium", "high", "urgent"]
STATUS_VALUES = Literal["not_started", "in_progress", "completed", "overdue"]


class CreateAssignmentRequest(BaseModel):
    """Data required to create a new assignment."""
    course_id: str
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    date_assigned: datetime | None = None
    deadline: datetime
    estimated_hours: float | None = Field(default=None, ge=0.5, le=200)
    priority: PRIORITY_VALUES = "medium"
    notes: str | None = None


class UpdateAssignmentRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    course_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    date_assigned: datetime | None = None
    deadline: datetime | None = None
    estimated_hours: float | None = Field(default=None, ge=0.5, le=200)
    priority: PRIORITY_VALUES | None = None
    status: STATUS_VALUES | None = None
    notes: str | None = None


class AssignmentResponse(BaseModel):
    """Assignment data returned to the client."""
    id: str
    user_id: str
    course_id: str
    title: str
    description: str | None
    date_assigned: datetime | None
    deadline: datetime
    estimated_hours: float | None
    priority: str
    status: str
    is_completed: bool
    completed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}