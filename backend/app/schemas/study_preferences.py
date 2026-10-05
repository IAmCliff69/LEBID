from typing import Literal

from pydantic import BaseModel, Field, field_validator


class StudyPreferencesRequest(BaseModel):
    """What the student chooses on the Study Preferences screen."""
    study_times: list[Literal["morning", "afternoon", "evening"]] = Field(
        ..., min_length=1, max_length=3
    )
    study_days: list[int] = Field(..., min_length=1, max_length=7)
    # The LONGEST a single study session may be (30 minutes to 4 hours).
    session_length_minutes: int = Field(..., ge=30, le=240)
    break_preference: Literal["short", "long"]

    @field_validator("study_times")
    @classmethod
    def validate_times(cls, times: list[str]) -> list[str]:
        # Remove duplicates and keep a fixed order
        order = ["morning", "afternoon", "evening"]
        return [name for name in order if name in times]
    
    @field_validator("study_days")
    @classmethod
    def validate_days(cls, days: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in days):
            raise ValueError(
                "study_days must only contain numbers from 0 (Monday) to 6 (Sunday)."
            )
        # Remove duplicates and keep the days in order
        return sorted(set(days))


class StudyPreferencesResponse(BaseModel):
    """Study preferences returned to the client."""
    study_times: list[str]
    study_days: list[int]
    session_length_minutes: int
    break_preference: str

    model_config = {"from_attributes": True}