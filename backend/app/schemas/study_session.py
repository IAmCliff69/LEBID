from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


PRIORITY_VALUES = Literal["low", "medium", "high", "urgent"]
STATUS_VALUES = Literal["planned", "in_progress", "completed", "skipped", "rescheduled"]


class CreateStudySessionRequest(BaseModel):
    """Data required to create a new study session."""
    course_id: str
    topic: str | None = Field(default=None, max_length=255)
    session_date: date
    start_time: time
    end_time: time
    venue: str = Field(..., min_length=1, max_length=255)
    priority: PRIORITY_VALUES = "medium"
    notes: str | None = None
    is_ai_generated: bool = False
        # How many weekly sessions to create, counting the first one.
    # 1 = just this one session. 4 = this one + the same slot for 3 more weeks.
    repeat_weeks: int = Field(default=1, ge=1, le=16)

    @model_validator(mode="after")
    def end_time_must_be_after_start_time(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class UpdateStudySessionRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    course_id: str | None = None
    topic: str | None = Field(default=None, max_length=255)
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=255)
    priority: PRIORITY_VALUES | None = None
    status: STATUS_VALUES | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def end_time_must_be_after_start_time(self):
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time.")
        return self


class StudySessionResponse(BaseModel):
    """Study session data returned to the client."""
    id: str
    user_id: str
    course_id: str
    topic: str | None
    session_date: date
    start_time: time
    end_time: time
    venue: str
    priority: str
    status: str
    notes: str | None
    rescheduled_from_id: str | None
    is_ai_generated: bool
    is_edit_locked: bool = False

    model_config = {"from_attributes": True}