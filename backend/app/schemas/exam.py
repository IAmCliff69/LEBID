from datetime import date, time, datetime
from typing import Literal

from pydantic import BaseModel, Field


EXAM_TYPES = Literal["mid_semester", "end_semester", "quiz", "test", "practical", "other"]


class CreateExamRequest(BaseModel):
    """Data required to create a new exam."""
    course_id: str
    title: str = Field(..., min_length=1, max_length=255)
    exam_type: EXAM_TYPES = "other"
    exam_date: date
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class UpdateExamRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    course_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    exam_type: EXAM_TYPES | None = None
    exam_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class ExamResponse(BaseModel):
    """Exam data returned to the client."""
    id: str
    user_id: str
    course_id: str
    title: str
    exam_type: str
    exam_date: date
    start_time: time | None
    end_time: time | None
    venue: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}