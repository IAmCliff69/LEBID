from pydantic import BaseModel, Field


class GenerateStudyPlanRequest(BaseModel):
    """
    Which classes to plan around.
    Send the import_id from the timetable upload. If it is left empty,
    the student's saved timetable is used instead.
    """
    import_id: str | None = None


class PlannedClass(BaseModel):
    """A class the plan was built around (shown as a lecture in the review)."""
    day_of_week: int  # 0 = Monday ... 6 = Sunday
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"
    course_name: str
    course_code: str | None = None
    class_type: str
    venue: str | None = None


class PlannedStudySession(BaseModel):
    """
    One proposed study session. It has no venue yet: the student adds a
    venue for every session in the Study Venues step before activation.
    """
    day_of_week: int
    start_time: str
    end_time: str
    duration_minutes: int
    course_name: str
    course_code: str | None = None
    topic: str
        # True when the session is before 07:00 or after 22:00, outside the usual hours
    outside_usual_hours: bool = False
    # True until the student chooses "Keep" for such a session
    needs_confirmation: bool = False


class GeneratedStudyPlan(BaseModel):
    """A proposed plan. Nothing here is saved until the student activates it."""
    summary: str
    classes: list[PlannedClass]
    sessions: list[PlannedStudySession]
    warnings: list[str] = []

class AdjustStudyPlanRequest(BaseModel):
    """The student's request in plain words, plus the plan as it looks right now."""
    instruction: str = Field(..., min_length=1, max_length=500)
    sessions: list[PlannedStudySession] = Field(..., max_length=100)
    # Which timetable import the classes come from (same as when the plan was built)
    import_id: str | None = None


class AdjustedStudyPlan(BaseModel):
    """The plan after the AI's changes."""
    message: str                # the AI's short explanation
    sessions: list[PlannedStudySession]
    changes: list[str]          # what was really changed
    warnings: list[str] = []    # what could not be changed, and why

class ActivationSession(PlannedStudySession):
    """A study session in the final plan. Unlike a proposed session, it has a venue."""
    venue: str = Field(..., min_length=1, max_length=255)


class ActivatePlanRequest(BaseModel):
    """The final, reviewed plan the student wants to start using."""
    import_id: str
    sessions: list[ActivationSession] = Field(..., min_length=1, max_length=100)
    # How many weeks each weekly session is created for, starting today
    weeks: int = Field(default=34, ge=1, le=20)


class ActivatedPlan(BaseModel):
    """What was saved when the plan was activated."""
    courses_created: int
    courses_reused: int
    timetable_entries_saved: int
    study_sessions_created: int
    weeks: int
    message: str        