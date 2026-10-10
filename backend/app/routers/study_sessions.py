from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.course import Course
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.study_session import (
    CreateStudySessionRequest,
    UpdateStudySessionRequest,
    StudySessionResponse,
)

router = APIRouter()


def get_session_or_404(session_id: str, user_id: str, db: Session) -> StudySession:
    """Fetches a study session by ID and verifies it belongs to the current user."""
    session = (
        db.query(StudySession)
        .filter(
            StudySession.id == session_id,
            StudySession.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found.",
        )
    return session


def verify_course_ownership(course_id: str, user_id: str, db: Session) -> Course:
    """Verifies the course exists and belongs to the current user."""
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

LOCKED_MESSAGE = (
    "This session ended more than 24 hours ago, so it can no longer be "
    "edited or rescheduled."
)


def session_has_started(session: StudySession) -> bool:
    """True once the session's start time has passed."""
    starts_at = datetime.combine(session.session_date, session.start_time)
    return datetime.now() >= starts_at


@router.post("", response_model=StudySessionResponse, status_code=status.HTTP_201_CREATED)
def create_study_session(
    payload: CreateStudySessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new study session.
    Venue is required — every session must have a location.
    """
    verify_course_ownership(payload.course_id, current_user.id, db)

        # One session per week for "repeat_weeks" weeks (1 = just this one).
    # They are saved together, so either all of them exist or none do.
    created_sessions = []
    for week in range(payload.repeat_weeks):
        session = StudySession(
            user_id=current_user.id,
            course_id=payload.course_id,
            topic=payload.topic,
            session_date=payload.session_date + timedelta(weeks=week),
            start_time=payload.start_time,
            end_time=payload.end_time,
            venue=payload.venue,
            priority=payload.priority,
            notes=payload.notes,
            is_ai_generated=payload.is_ai_generated,
        )
        db.add(session)
        created_sessions.append(session)

    db.commit()

    # Return the first session (the one on the date the student picked)
    first_session = created_sessions[0]
    db.refresh(first_session)
    return first_session


@router.get("", response_model=list[StudySessionResponse])
def list_study_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    course_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    """
    Returns study sessions for the current user with optional filters.

    Filters:
    - course_id: filter by course
    - status: planned, in_progress, completed, skipped, rescheduled
    - date_from: sessions on or after this date
    - date_to: sessions on or before this date
    """
    query = db.query(StudySession).filter(StudySession.user_id == current_user.id)

    if course_id:
        query = query.filter(StudySession.course_id == course_id)

    if status_filter:
        query = query.filter(StudySession.status == status_filter)

    if date_from:
        query = query.filter(StudySession.session_date >= date_from)

    if date_to:
        query = query.filter(StudySession.session_date <= date_to)

    sessions = query.order_by(
        StudySession.session_date.asc(),
        StudySession.start_time.asc(),
    ).all()
    return sessions


@router.get("/today", response_model=list[StudySessionResponse])
def get_today_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all study sessions scheduled for today.
    Used by the dashboard to show what the student has planned today.
    """
    today = date.today()
    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.session_date == today,
        )
        .order_by(StudySession.start_time.asc())
        .all()
    )
    return sessions


@router.get("/week", response_model=list[StudySessionResponse])
def get_week_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all study sessions for the current week (today through 7 days).
    Used by the weekly planner view.
    """
    today = date.today()
    end_of_week = today + timedelta(days=7)

    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.session_date >= today,
            StudySession.session_date <= end_of_week,
        )
        .order_by(
            StudySession.session_date.asc(),
            StudySession.start_time.asc(),
        )
        .all()
    )
    return sessions


@router.get("/missed", response_model=list[StudySessionResponse])
def get_missed_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all study sessions that were skipped or are planned
    but in the past — sessions the student missed without marking.

    Used by the AI assistant to detect missed work and suggest
    rescheduling.
    """
    today = date.today()
    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.session_date < today,
            StudySession.status.in_(["planned", "skipped"]),
        )
        .order_by(StudySession.session_date.desc())
        .all()
    )
    return sessions


@router.get("/{session_id}", response_model=StudySessionResponse)
def get_study_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a single study session by ID."""
    return get_session_or_404(session_id, current_user.id, db)


@router.patch("/{session_id}", response_model=StudySessionResponse)
def update_study_session(
    session_id: str,
    payload: UpdateStudySessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates a study session. Only provided fields are changed.

    Common uses:
    - Mark as completed: {"status": "completed"}
    - Mark as skipped: {"status": "skipped"}
    - Reschedule: update session_date, start_time, end_time
    - Update venue: {"venue": "Library Room 2"}
    """
    session = get_session_or_404(session_id, current_user.id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )
            # After 24 hours, only the status may still change (completed / skipped / undo)
    changes_details = set(updates) - {"status"}
    if changes_details and session.is_edit_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=LOCKED_MESSAGE,
        )

    # A session that has not started yet cannot be marked as completed
    if updates.get("status") == "completed" and not session_has_started(session):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can mark a session as completed once it has started.",
        )

    if "course_id" in updates and updates["course_id"] is not None:
        verify_course_ownership(updates["course_id"], current_user.id, db)

    for field, value in updates.items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/reschedule", response_model=StudySessionResponse)
def reschedule_study_session(
    session_id: str,
    payload: CreateStudySessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reschedules a study session by creating a new session and
    marking the original as rescheduled.

    The new session tracks which original session it came from
    via rescheduled_from_id, so the AI can see rescheduling patterns.
    """
    original = get_session_or_404(session_id, current_user.id, db)
    if original.is_edit_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=LOCKED_MESSAGE,
        )
    verify_course_ownership(payload.course_id, current_user.id, db)

    # Mark original as rescheduled
    original.status = "rescheduled"

    # Create new session linked to the original
    new_session = StudySession(
        user_id=current_user.id,
        course_id=payload.course_id,
        topic=payload.topic,
        session_date=payload.session_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        venue=payload.venue,
        priority=payload.priority,
        notes=payload.notes,
        rescheduled_from_id=original.id,
        is_ai_generated=False,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.delete("/{session_id}", response_model=MessageResponse)
def delete_study_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a study session permanently."""
    session = get_session_or_404(session_id, current_user.id, db)
    db.delete(session)
    db.commit()
    return {"message": "Study session deleted successfully."}