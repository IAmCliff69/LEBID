from datetime import date, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.conflicts import check_conflicts
from pydantic import BaseModel

router = APIRouter()


class ConflictCheckRequest(BaseModel):
    """Request body for checking a time slot for conflicts."""
    check_date: date
    start_time: time
    end_time: time
    exclude_session_id: str | None = None
    exclude_event_id: str | None = None


class ConflictItem(BaseModel):
    """A single detected conflict."""
    conflict_type: str
    description: str
    conflicting_item: dict


class ConflictCheckResponse(BaseModel):
    """Response from the conflict check endpoint."""
    has_conflicts: bool
    conflict_count: int
    conflicts: list[ConflictItem]
    message: str


@router.post("/check", response_model=ConflictCheckResponse)
def check_schedule_conflicts(
    payload: ConflictCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Checks a proposed time slot for scheduling conflicts.

    Checks the given date and time range against all existing
    schedule items for the current user:
    - Timetable entries (recurring weekly classes)
    - Study sessions
    - Events
    - Exams

    Use this before creating or updating a study session or event
    to warn the student about potential conflicts.

    The exclude_session_id and exclude_event_id parameters allow
    you to exclude a specific item when checking for conflicts
    during an update operation.
    """
    conflicts = check_conflicts(
        user_id=current_user.id,
        check_date=payload.check_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        db=db,
        exclude_session_id=payload.exclude_session_id,
        exclude_event_id=payload.exclude_event_id,
    )

    conflict_items = [
        ConflictItem(
            conflict_type=c.conflict_type,
            description=c.description,
            conflicting_item=c.conflicting_item,
        )
        for c in conflicts
    ]

    if conflicts:
        message = (
            f"Found {len(conflicts)} conflict{'s' if len(conflicts) > 1 else ''} "
            f"for {payload.check_date} "
            f"{payload.start_time.strftime('%H:%M')}–"
            f"{payload.end_time.strftime('%H:%M')}."
        )
    else:
        message = (
            f"No conflicts found for {payload.check_date} "
            f"{payload.start_time.strftime('%H:%M')}–"
            f"{payload.end_time.strftime('%H:%M')}."
        )

    return ConflictCheckResponse(
        has_conflicts=bool(conflicts),
        conflict_count=len(conflicts),
        conflicts=conflict_items,
        message=message,
    )


@router.get("/day", response_model=ConflictCheckResponse)
def check_day_for_conflicts(
    check_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans an entire day for any overlapping schedule items.

    Useful for the planner view to highlight days that have
    scheduling problems. Checks the full day (00:00–23:59).
    """
    conflicts = check_conflicts(
        user_id=current_user.id,
        check_date=check_date,
        start_time=time(0, 0),
        end_time=time(23, 59),
        db=db,
    )

    conflict_items = [
        ConflictItem(
            conflict_type=c.conflict_type,
            description=c.description,
            conflicting_item=c.conflicting_item,
        )
        for c in conflicts
    ]

    message = (
        f"Found {len(conflicts)} conflict{'s' if len(conflicts) > 1 else ''} on {check_date}."
        if conflicts
        else f"No conflicts found on {check_date}."
    )

    return ConflictCheckResponse(
        has_conflicts=bool(conflicts),
        conflict_count=len(conflicts),
        conflicts=conflict_items,
        message=message,
    )