from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.course import Course
from app.models.timetable import TimetableEntry
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.timetable import (
    CreateTimetableEntryRequest,
    DAY_NAMES,
    DaySchedule,
    TimetableEntryResponse,
    UpdateTimetableEntryRequest,
    WeeklyTimetableResponse,
)

router = APIRouter()


def get_entry_or_404(entry_id: str, user_id: str, db: Session) -> TimetableEntry:
    """
    Fetches a timetable entry by ID and verifies ownership.
    Raises 404 if not found or not owned by this user.
    """
    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.id == entry_id,
            TimetableEntry.user_id == user_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found.",
        )
    return entry


def verify_course_ownership(course_id: str, user_id: str, db: Session) -> Course:
    """
    Verifies that the course exists and belongs to the current user.
    Raises 404 if the course is not found or belongs to another user.
    """
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.user_id == user_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    return course


@router.post("", response_model=TimetableEntryResponse, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: CreateTimetableEntryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new timetable entry.
    Verifies that the referenced course belongs to the current user.
    """
    # Ensure the course belongs to this user
    verify_course_ownership(payload.course_id, current_user.id, db)

    entry = TimetableEntry(
        user_id=current_user.id,
        course_id=payload.course_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        venue=payload.venue,
        lecturer=payload.lecturer,
        class_type=payload.class_type,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[TimetableEntryResponse])
def list_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all active timetable entries for the current user,
    ordered by day and start time.
    """
    entries = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == current_user.id,
            TimetableEntry.is_active == True,
        )
        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
        .all()
    )
    return entries


@router.get("/weekly", response_model=WeeklyTimetableResponse)
def get_weekly_timetable(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the full weekly timetable grouped by day.

    The response contains all seven days, each with a list of
    entries scheduled on that day. Days with no classes have
    an empty entries list.

    This is the primary view used to display the student's
    weekly class schedule.
    """
    entries = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == current_user.id,
            TimetableEntry.is_active == True,
        )
        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
        .all()
    )

    # Group entries by day
    entries_by_day: dict[int, list[TimetableEntry]] = {i: [] for i in range(7)}
    for entry in entries:
        entries_by_day[entry.day_of_week].append(entry)

    # Build the weekly structure
    week = [
        DaySchedule(
            day=day,
            day_name=DAY_NAMES[day],
            entries=[TimetableEntryResponse.model_validate(e) for e in day_entries],
        )
        for day, day_entries in entries_by_day.items()
    ]

    return WeeklyTimetableResponse(week=week)


@router.get("/{entry_id}", response_model=TimetableEntryResponse)
def get_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a single timetable entry by ID.
    Returns 404 if not found or not owned by the current user.
    """
    return get_entry_or_404(entry_id, current_user.id, db)


@router.patch("/{entry_id}", response_model=TimetableEntryResponse)
def update_entry(
    entry_id: str,
    payload: UpdateTimetableEntryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates a timetable entry. Only provided fields are changed.
    If course_id is being updated, verifies the new course belongs
    to the current user.
    """
    entry = get_entry_or_404(entry_id, current_user.id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    # If course_id is being changed, verify the new course belongs to this user
    if "course_id" in updates:
        verify_course_ownership(updates["course_id"], current_user.id, db)

    for field, value in updates.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", response_model=MessageResponse)
def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a timetable entry permanently.
    """
    entry = get_entry_or_404(entry_id, current_user.id, db)
    db.delete(entry)
    db.commit()
    return {"message": "Timetable entry deleted successfully."}