from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


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

    The course can be given in two ways:
    - course_id: one of the student's existing courses, or
    - course_name (and optionally course_code): Lebid finds the matching
      course, or creates it if the student does not have it yet.
    """
    course_id: str | None = None
    course_name: str | None = Field(default=None, max_length=255)
    course_code: str | None = Field(default=None, max_length=50)
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    venue: str | None = None
    lecturer: str | None = None
    class_type: str = "lecture"
    notes: str | None = None

    @model_validator(mode="after")
    def check_course_is_given(self):
        has_name = bool(self.course_name and self.course_name.strip())
        if not self.course_id and not has_name:
            raise ValueError(
                "Each entry needs a course: choose one of your courses or give a course name."
            )
        return self

class ConfirmImportRequest(BaseModel):
    """
    The student's confirmed timetable entries ready to be saved.
    """
    entries: list[ConfirmEntryRequest]

    # True = the new timetable REPLACES the current one
    replace_existing: bool = False

    # Courses that are not in the new timetable but have work linked to them
    # (tasks, assignments, exams, study sessions) are kept, unless the student
    # ticked them in the confirmation pop-up. Those ids are listed here.
    delete_course_ids: list[str] = []


class ConfirmImportResponse(BaseModel):
    """Result of saving confirmed timetable entries."""
    saved_count: int
    message: str
    courses_created: int = 0
    duplicates_skipped: int = 0
    # Only used when the new timetable replaced the old one
    classes_removed: int = 0
    sessions_removed: int = 0
    courses_removed: int = 0
    courses_kept: int = 0


class CourseUsage(BaseModel):
    """A course and how much work is linked to it."""
    id: str
    code: str | None
    name: str
    tasks: int
    assignments: int
    exams: int
    study_sessions: int


class ReplacePreviewResponse(BaseModel):
    """What replacing the timetable would do (nothing is changed yet)."""
    existing_class_count: int
    new_class_count: int
    upcoming_ai_sessions_count: int
    # Not in the new timetable and nothing linked: removed automatically
    courses_to_remove: list[CourseUsage]
    # Not in the new timetable but with work linked: kept unless the student ticks them
    courses_with_work: list[CourseUsage]

class PendingImportResponse(ExtractionResponse):
    """An earlier upload that the student has not confirmed yet."""
    original_filename: str
    created_at: datetime    