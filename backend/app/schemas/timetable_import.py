from pydantic import BaseModel, Field
from typing import Any


class ExtractedEntry(BaseModel):
    """
    A single class entry extracted from the timetable image by Gemini.
    These are NOT yet saved to the database — they are shown to the
    student for review first.
    """
    course_name: str
    course_code: str | None = None
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str  # "HH:MM" format
    end_time: str    # "HH:MM" format
    venue: str | None = None
    lecturer: str | None = None
    class_type: str = "lecture"


class ExtractionResponse(BaseModel):
    """
    The response returned to the student after their timetable is processed.
    Contains the import session ID and the extracted entries for review.
    """
    import_id: str
    status: str
    extracted_entries: list[ExtractedEntry]
    extraction_notes: str | None = None
    message: str


class ConfirmEntryRequest(BaseModel):
    """
    A single entry the student has reviewed and wants to save.
    The student must provide a course_id linking this entry to one
    of their existing courses.
    """
    course_id: str
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    venue: str | None = None
    lecturer: str | None = None
    class_type: str = "lecture"
    notes: str | None = None


class ConfirmImportRequest(BaseModel):
    """
    The student's confirmed timetable entries ready to be saved.
    """
    entries: list[ConfirmEntryRequest]


class ConfirmImportResponse(BaseModel):
    """Result of saving confirmed timetable entries."""
    saved_count: int
    message: str