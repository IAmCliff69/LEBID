from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


FLEXIBILITY_VALUES = Literal["fixed", "flexible", "protected"]


class CreateEventRequest(BaseModel):
    """Data required to create a new event."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    event_date: date
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    flexibility: FLEXIBILITY_VALUES = "fixed"
    is_recurring: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time.")
        return self


class UpdateEventRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    flexibility: FLEXIBILITY_VALUES | None = None
    is_recurring: bool | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time.")
        return self


class EventResponse(BaseModel):
    """Event data returned to the client."""
    id: str
    user_id: str
    title: str
    description: str | None
    event_date: date
    start_time: time | None
    end_time: time | None
    location: str | None
    flexibility: str
    is_recurring: bool
    notes: str | None

    model_config = {"from_attributes": True}