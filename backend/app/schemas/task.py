from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# Valid values for each field
PRIORITY_VALUES = Literal["low", "medium", "high", "urgent"]
STATUS_VALUES = Literal["not_started", "in_progress", "completed", "overdue"]
CATEGORY_VALUES = Literal["academic", "personal", "administrative", "other"]


class CreateTaskRequest(BaseModel):
    """Data required to create a new task."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    course_id: str | None = None
    deadline: datetime | None = None
    priority: PRIORITY_VALUES = "medium"
    category: CATEGORY_VALUES = "academic"
    estimated_duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    notes: str | None = None


class UpdateTaskRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    course_id: str | None = None
    deadline: datetime | None = None
    priority: PRIORITY_VALUES | None = None
    status: STATUS_VALUES | None = None
    category: CATEGORY_VALUES | None = None
    estimated_duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    notes: str | None = None


class TaskResponse(BaseModel):
    """Task data returned to the client."""
    id: str
    user_id: str
    course_id: str | None
    title: str
    description: str | None
    deadline: datetime | None
    priority: str
    status: str
    category: str
    estimated_duration_minutes: int | None
    notes: str | None
    is_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}