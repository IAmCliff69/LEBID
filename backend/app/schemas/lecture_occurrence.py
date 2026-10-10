from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel

LECTURE_MARKS = Literal["missed", "cancelled", "completed"]


class MarkLectureRequest(BaseModel):
    """Mark one date of a weekly class as missed or cancelled."""
    timetable_entry_id: str
    occurrence_date: date
    status: LECTURE_MARKS


class LectureOccurrenceResponse(BaseModel):
    id: str
    timetable_entry_id: str | None
    occurrence_date: date
    status: str
    course_code: str | None
    course_name: str
    course_color: str | None
    class_type: str
    start_time: time
    end_time: time
    venue: str | None
    created_at: datetime

    model_config = {"from_attributes": True}