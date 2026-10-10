from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.lecture_occurrence import LectureOccurrence
from app.models.timetable import TimetableEntry
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.lecture_occurrence import (
    LectureOccurrenceResponse,
    MarkLectureRequest,
)

router = APIRouter()


@router.get("", response_model=list[LectureOccurrenceResponse])
def list_lecture_occurrences(
    mark: Literal["missed", "cancelled", "completed"] | None = Query(default=None, alias="status"),
    timetable_entry_id: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists the student's missed / cancelled lectures, newest first.
    Optional filters: ?status=missed, ?status=cancelled, ?timetable_entry_id=...
    """
    query = db.query(LectureOccurrence).filter(
        LectureOccurrence.user_id == current_user.id
    )
    if mark:
        query = query.filter(LectureOccurrence.status == mark)
    if timetable_entry_id:
        query = query.filter(
            LectureOccurrence.timetable_entry_id == timetable_entry_id
        )

    query = query.order_by(
        LectureOccurrence.occurrence_date.desc(),
        LectureOccurrence.start_time.desc(),
    )
    if limit:
        query = query.limit(limit)
    return query.all()


@router.post("", response_model=LectureOccurrenceResponse)
def mark_lecture(
    payload: MarkLectureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks one date of a weekly class as missed or cancelled.
    If that date already has a mark, the mark is changed.
    """
    entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.id == payload.timetable_entry_id,
            TimetableEntry.user_id == current_user.id,
        )
        .first()
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    # The class must actually take place on that date (Monday = 0 ... Sunday = 6)
    if payload.occurrence_date.weekday() != entry.day_of_week:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This class doesn't take place on that day.",
        )

    # A lecture can only be "missed" or "completed" once it has started
    if payload.status in ("missed", "completed"):
        starts_at = datetime.combine(payload.occurrence_date, entry.start_time)
        if datetime.now() < starts_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You can mark a lecture as {payload.status} once it has started.",
            )

    course = entry.course
    existing = (
        db.query(LectureOccurrence)
        .filter(
            LectureOccurrence.timetable_entry_id == entry.id,
            LectureOccurrence.occurrence_date == payload.occurrence_date,
        )
        .first()
    )

    if existing is None:
        existing = LectureOccurrence(
            user_id=current_user.id,
            timetable_entry_id=entry.id,
            occurrence_date=payload.occurrence_date,
        )
        db.add(existing)

    existing.status = payload.status
    # Keep a copy of the class details so the history stays readable
    existing.course_code = course.code
    existing.course_name = course.name
    existing.course_color = course.color
    existing.class_type = entry.class_type
    existing.start_time = entry.start_time
    existing.end_time = entry.end_time
    existing.venue = entry.venue

    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/{occurrence_id}", response_model=MessageResponse)
def remove_lecture_mark(
    occurrence_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Removes a missed / cancelled mark (the "Undo" button)."""
    occurrence = (
        db.query(LectureOccurrence)
        .filter(
            LectureOccurrence.id == occurrence_id,
            LectureOccurrence.user_id == current_user.id,
        )
        .first()
    )
    if occurrence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That mark was not found.",
        )

    db.delete(occurrence)
    db.commit()
    return MessageResponse(message="Mark removed.")