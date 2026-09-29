from datetime import date, time
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.timetable import TimetableEntry
from app.models.study_session import StudySession
from app.models.event import Event
from app.models.exam import Exam


@dataclass
class Conflict:
    """
    Represents a detected scheduling conflict.

    conflict_type: what kind of conflict this is
    description: human-readable explanation
    conflicting_item: the existing schedule item that conflicts
    """
    conflict_type: str
    description: str
    conflicting_item: dict[str, Any]


def times_overlap(
    start_a: time,
    end_a: time,
    start_b: time,
    end_b: time,
) -> bool:
    """
    Returns True if two time ranges overlap.
    Two ranges overlap if one starts before the other ends.
    """
    return start_a < end_b and start_b < end_a


def check_conflicts(
    user_id: str,
    check_date: date,
    start_time: time,
    end_time: time,
    db: Session,
    exclude_session_id: str | None = None,
    exclude_event_id: str | None = None,
) -> list[Conflict]:
    """
    Checks a proposed time slot for conflicts against all existing
    schedule items for the given user on the given date.

    Checks against:
    - Timetable entries (recurring weekly classes)
    - Study sessions
    - Events
    - Exams

    Args:
        user_id: the student's user ID
        check_date: the date to check
        start_time: proposed start time
        end_time: proposed end time
        db: database session
        exclude_session_id: optional study session ID to exclude
            (used when updating an existing session)
        exclude_event_id: optional event ID to exclude
            (used when updating an existing event)

    Returns:
        A list of Conflict objects. Empty list means no conflicts.
    """
    conflicts: list[Conflict] = []
    day_of_week = check_date.weekday()  # 0=Monday, 6=Sunday

    # --- Check timetable entries (recurring weekly classes) ---
    timetable_entries = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == user_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.is_active == True,
        )
        .all()
    )

    for entry in timetable_entries:
        if times_overlap(start_time, end_time, entry.start_time, entry.end_time):
            conflicts.append(Conflict(
                conflict_type="timetable_entry",
                description=(
                    f"Conflicts with your {entry.class_type} "
                    f"({entry.start_time.strftime('%H:%M')}–"
                    f"{entry.end_time.strftime('%H:%M')})"
                    + (f" at {entry.venue}" if entry.venue else "")
                ),
                conflicting_item={
                    "id": entry.id,
                    "type": "timetable_entry",
                    "class_type": entry.class_type,
                    "start_time": str(entry.start_time),
                    "end_time": str(entry.end_time),
                    "venue": entry.venue,
                },
            ))

    # --- Check study sessions ---
    study_session_query = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.session_date == check_date,
            StudySession.status.notin_(["completed", "skipped", "rescheduled"]),
        )
    )
    if exclude_session_id:
        study_session_query = study_session_query.filter(
            StudySession.id != exclude_session_id
        )

    study_sessions = study_session_query.all()

    for session in study_sessions:
        if times_overlap(start_time, end_time, session.start_time, session.end_time):
            conflicts.append(Conflict(
                conflict_type="study_session",
                description=(
                    f"Conflicts with an existing study session "
                    f"({session.start_time.strftime('%H:%M')}–"
                    f"{session.end_time.strftime('%H:%M')})"
                    + (f" at {session.venue}" if session.venue else "")
                ),
                conflicting_item={
                    "id": session.id,
                    "type": "study_session",
                    "topic": session.topic,
                    "start_time": str(session.start_time),
                    "end_time": str(session.end_time),
                    "venue": session.venue,
                },
            ))

    # --- Check events ---
    event_query = (
        db.query(Event)
        .filter(
            Event.user_id == user_id,
            Event.event_date == check_date,
            Event.start_time.isnot(None),
            Event.end_time.isnot(None),
        )
    )
    if exclude_event_id:
        event_query = event_query.filter(Event.id != exclude_event_id)

    events = event_query.all()

    for event in events:
        if times_overlap(start_time, end_time, event.start_time, event.end_time):
            conflicts.append(Conflict(
                conflict_type="event",
                description=(
                    f"Conflicts with '{event.title}' "
                    f"({event.start_time.strftime('%H:%M')}–"
                    f"{event.end_time.strftime('%H:%M')})"
                    + (f" at {event.location}" if event.location else "")
                ),
                conflicting_item={
                    "id": event.id,
                    "type": "event",
                    "title": event.title,
                    "flexibility": event.flexibility,
                    "start_time": str(event.start_time),
                    "end_time": str(event.end_time),
                    "location": event.location,
                },
            ))

    # --- Check exams ---
    exams = (
        db.query(Exam)
        .filter(
            Exam.user_id == user_id,
            Exam.exam_date == check_date,
            Exam.start_time.isnot(None),
            Exam.end_time.isnot(None),
        )
        .all()
    )

    for exam in exams:
        if times_overlap(start_time, end_time, exam.start_time, exam.end_time):
            conflicts.append(Conflict(
                conflict_type="exam",
                description=(
                    f"Conflicts with exam '{exam.title}' "
                    f"({exam.start_time.strftime('%H:%M')}–"
                    f"{exam.end_time.strftime('%H:%M')})"
                    + (f" at {exam.venue}" if exam.venue else "")
                ),
                conflicting_item={
                    "id": exam.id,
                    "type": "exam",
                    "title": exam.title,
                    "exam_type": exam.exam_type,
                    "start_time": str(exam.start_time),
                    "end_time": str(exam.end_time),
                    "venue": exam.venue,
                },
            ))

    return conflicts