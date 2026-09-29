from datetime import time
from typing import Literal

from pydantic import AliasPath, BaseModel, Field, model_validator


# Valid class types
CLASS_TYPES = Literal["lecture", "tutorial", "lab", "practical", "seminar", "other"]

# Day names for the weekly view
DAY_NAMES = {
    0: "Monday",
    1: "Tuesday",
    2: "Wednesday",
    3: "Thursday",
    4: "Friday",
    5: "Saturday",
    6: "Sunday",
}


class CreateTimetableEntryRequest(BaseModel):
    """Data required to create a timetable entry."""
    course_id: str
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    venue: str | None = Field(default=None, max_length=255)
    lecturer: str | None = Field(default=None, max_length=255)
    class_type: CLASS_TYPES = "lecture"
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def end_time_must_be_after_start_time(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class UpdateTimetableEntryRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    course_id: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = Field(default=None, max_length=255)
    lecturer: str | None = Field(default=None, max_length=255)
    class_type: CLASS_TYPES | None = None
    notes: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    @model_validator(mode="after")
    def end_time_must_be_after_start_time(self):
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time.")
        return self


class TimetableEntryResponse(BaseModel):
    """Timetable entry data returned to the client."""
    id: str
    user_id: str
    course_id: str
    course_code: str | None = Field(
        default=None,
        validation_alias=AliasPath("course", "code"),
    )
    course_name: str = Field(
        validation_alias=AliasPath("course", "name"),
    )
    course_color: str | None = Field(
        default=None,
        validation_alias=AliasPath("course", "color"),
    )
    day_of_week: int
    day_name: str = ""
    start_time: time
    end_time: time
    venue: str | None
    lecturer: str | None
    class_type: str
    notes: str | None
    is_active: bool

    model_config = {"from_attributes": True}

    def model_post_init(self, __context) -> None:
        # Automatically populate day_name from day_of_week
        self.day_name = DAY_NAMES.get(self.day_of_week, "")


class DaySchedule(BaseModel):
    """A single day's entries in the weekly timetable view."""
    day: int
    day_name: str
    entries: list[TimetableEntryResponse]


class WeeklyTimetableResponse(BaseModel):
    """The full weekly timetable grouped by day."""
    week: list[DaySchedule]