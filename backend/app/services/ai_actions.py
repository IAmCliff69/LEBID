import uuid
import logging
from datetime import date, time
from typing import Any

from pydantic import ValidationError
from pydantic_core import to_jsonable_python
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.course import Course
from app.models.event import Event
from app.models.exam import Exam
from app.models.study_session import StudySession
from app.models.task import Task
from app.schemas.ai import AiAction
from app.schemas.assignment import CreateAssignmentRequest, UpdateAssignmentRequest
from app.schemas.event import CreateEventRequest, UpdateEventRequest
from app.schemas.exam import CreateExamRequest, UpdateExamRequest
from app.schemas.study_session import (
    CreateStudySessionRequest,
    UpdateStudySessionRequest,
)
from app.schemas.task import CreateTaskRequest, UpdateTaskRequest
from app.services.conflicts import check_conflicts

# The most changes the AI may propose in one reply
MAX_ACTIONS = 10

logger = logging.getLogger("lebid.ai")

# What the AI is allowed to change. For each kind of item we keep:
#   model  = the database table (so we can find the student's own item)
#   create = the rules for a new item (the SAME rules the normal forms use)
#   update = the rules for changing an item
#   name   = a plain-words name used in messages
ENTITIES = {
    "study_session": {
        "model": StudySession,
        "create": CreateStudySessionRequest,
        "update": UpdateStudySessionRequest,
        "name": "study session",
    },
    "task": {
        "model": Task,
        "create": CreateTaskRequest,
        "update": UpdateTaskRequest,
        "name": "task",
    },
    "assignment": {
        "model": Assignment,
        "create": CreateAssignmentRequest,
        "update": UpdateAssignmentRequest,
        "name": "assignment",
    },
    "exam": {
        "model": Exam,
        "create": CreateExamRequest,
        "update": UpdateExamRequest,
        "name": "exam",
    },
    "event": {
        "model": Event,
        "create": CreateEventRequest,
        "update": UpdateEventRequest,
        "name": "event",
    },
}

# Fields the AI may never set. A repeat would create many sessions at once,
# and "AI generated" sessions are the ones a rebuilt study plan replaces.
BLOCKED_FIELDS = {"is_ai_generated", "repeat_weeks"}


def _owns_course(db: Session, user_id: str, course_id: str) -> bool:
    """True if this course belongs to the student."""
    return (
        db.query(Course)
        .filter(
            Course.id == course_id,
            Course.user_id == user_id,
            Course.is_active.is_(True),
        )
        .first()
        is not None
    )


def _label(entity: str, row: Any) -> str:
    """
    A short description of the REAL item an action points at. It comes from
    the database, not from the AI, so the student can see what will really change.
    """
    if entity == "study_session":
        topic = f" ({row.topic})" if row.topic else ""
        return (
            f"Study session on {row.session_date} "
            f"{row.start_time.strftime('%H:%M')}-{row.end_time.strftime('%H:%M')}"
            f"{topic}"
        )
    return str(row.title)


def _old_values(row: Any, fields: Any) -> dict[str, Any]:
    """The current values of the fields an update will change (used by Undo)."""
    return {name: to_jsonable_python(getattr(row, name, None)) for name in fields}


def _snapshot(entity: str, row: Any) -> dict[str, Any] | None:
    """
    Everything needed to create the item again, used by Undo after a delete.
    Returns None if the item can't be described (then Undo is not offered).
    """
    create_rules = ENTITIES[entity]["create"]
    values = {}
    for name in create_rules.model_fields:
        if name in BLOCKED_FIELDS:
            continue
        value = getattr(row, name, None)
        if value is not None:
            values[name] = value
    try:
        checked = create_rules.model_validate(values)
        return checked.model_dump(mode="json", exclude_unset=True)
    except ValidationError:
        return None


def _session_problem(
    kind: str,
    payload: dict[str, Any],
    row: Any,
    user_id: str,
    db: Session,
    planned_slots: list[tuple[date, time, time]],
) -> str | None:
    """
    Extra checks for study sessions: the day must not have passed and the
    time must be free. Returns a plain-words problem, or None if it is fine.
    """
    touches_time = any(
        name in payload for name in ("session_date", "start_time", "end_time")
    )
    if kind == "update" and not touches_time:
        return None  # for example just marking a session completed

    # The final day and times: the new values, or the current ones when updating
    day = (
        date.fromisoformat(payload["session_date"])
        if "session_date" in payload
        else row.session_date
    )
    start = (
        time.fromisoformat(payload["start_time"])
        if "start_time" in payload
        else row.start_time
    )
    end = (
        time.fromisoformat(payload["end_time"])
        if "end_time" in payload
        else row.end_time
    )

    if end <= start:
        return "its end time is not after its start time"

    if ("session_date" in payload or kind == "create") and day < date.today():
        return "that date has already passed"

    conflicts = check_conflicts(
        user_id,
        day,
        start,
        end,
        db,
        exclude_session_id=row.id if row is not None else None,
    )
    if conflicts:
        return f"it would clash with something in your schedule ({conflicts[0].description})"

    # Two suggestions in the same reply must not overlap each other.
    for other_day, other_start, other_end in planned_slots:
        if other_day == day and start < other_end and other_start < end:
            return "it would overlap another change I suggested"
    planned_slots.append((day, start, end))

    return None


def _check_one(
    raw: Any,
    user_id: str,
    db: Session,
    planned_slots: list[tuple[date, time, time]],
) -> tuple[AiAction | None, str | None]:
    """
    Checks one change the AI suggested.
    Returns (the checked action, None) or (None, the reason it was left out).
    """
    if not isinstance(raw, dict):
        return None, "I left out a suggested change I could not understand."

    kind = raw.get("action")
    entity = raw.get("entity")
    config = ENTITIES.get(entity) if isinstance(entity, str) else None
    if kind not in ("create", "update", "delete") or config is None:
        return None, "I left out a suggested change I could not understand."

    name = config["name"]
    title = str(raw.get("title") or "").strip()[:150] or f"{kind.capitalize()} {name}"
    description = str(raw.get("description") or "").strip()[:500]

    # 1. Update and delete need an item that belongs to THIS student
    row = None
    if kind in ("update", "delete"):
        item_id = raw.get("id")
        if not isinstance(item_id, str) or not item_id:
            return None, f"I left out \"{title}\" because it did not say which {name} it meant."

        model = config["model"]
        row = (
            db.query(model)
            .filter(model.id == item_id, model.user_id == user_id)
            .first()
        )
        if row is None:
            return None, f"I left out \"{title}\" because I could not find that {name}."

        if entity == "study_session" and row.is_edit_locked:
            return None, (
                f"I left out \"{title}\" because that study session ended more "
                "than 24 hours ago and can no longer be changed."
            )

    # 2. Create and update: the details must follow the same rules as the forms
    payload: dict[str, Any] = {}
    if kind in ("create", "update"):
        body = raw.get("payload")
        if not isinstance(body, dict):
            return None, f"I left out \"{title}\" because its details were missing."

        body = {key: value for key, value in body.items() if key not in BLOCKED_FIELDS}

        try:
            checked = config[kind].model_validate(body)
        except ValidationError:
            return None, f"I left out \"{title}\" because some of its details were not valid."

        payload = checked.model_dump(mode="json", exclude_unset=True)
        if kind == "update" and not payload:
            return None, f"I left out \"{title}\" because it did not change anything."

        course_id = payload.get("course_id")
        if course_id and not _owns_course(db, user_id, course_id):
            return None, f"I left out \"{title}\" because I could not find that course."

        # 3. Study sessions also need a free time slot on a day that is not past
        if entity == "study_session":
            problem = _session_problem(
                kind, payload, row, user_id, db, planned_slots
            )
            if problem:
                return None, f"I left out \"{title}\" because {problem}."

    # 4. What Undo needs
    previous = None
    if kind == "update":
        previous = _old_values(row, payload.keys())
    elif kind == "delete":
        previous = _snapshot(entity, row)

    action = AiAction(
        key=uuid.uuid4().hex,
        action=kind,
        entity=entity,
        id=row.id if row is not None else None,
        title=title,
        description=description,
        target=_label(entity, row) if row is not None else None,
        payload=payload,
        previous=previous,
    )
    return action, None


def validate_actions(
    raw_actions: Any, user_id: str, db: Session
) -> tuple[list[AiAction], list[str]]:
    """
    Checks every change the AI suggested before the student sees it.

    Returns the changes that passed, and a plain-words note for each one that
    was left out. Nothing is changed in the database here: the student still
    has to press Apply.
    """
    accepted: list[AiAction] = []
    warnings: list[str] = []
    planned_slots: list[tuple[date, time, time]] = []
    planned_slots: list[tuple[date, time, time]] = []

    if not isinstance(raw_actions, list):
        return accepted, warnings

    for raw in raw_actions[:MAX_ACTIONS]:
        try:
            action, problem = _check_one(raw, user_id, db, planned_slots)
        except Exception as error:
            # One bad suggestion must never break the whole reply
            logger.exception("AI action check failed")
            action, problem = None, "I left out a suggested change I could not check."

        if action is not None:
            accepted.append(action)
        elif problem:
            warnings.append(problem)

    if len(raw_actions) > MAX_ACTIONS:
        warnings.append(
            f"I only show the first {MAX_ACTIONS} suggested changes at a time."
        )

    return accepted, warnings