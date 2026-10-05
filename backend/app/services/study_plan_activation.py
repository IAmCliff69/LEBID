from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.study_session import StudySession
from app.models.timetable import TimetableEntry
from app.models.timetable_import import TimetableImport
from app.models.user import User
from app.schemas.study_plan import ActivatedPlan, ActivationSession

# Shared rules from the other planning services
from app.services.study_plan_adjuster import _find_problem
from app.services.study_planner import (
    DAY_NAMES,
    ClassBlock,
    _parse_hhmm,
)


def _identity(name: str, code: str | None) -> tuple[str, str]:
    """A course is recognised by its code and name, ignoring capitals and spaces."""
    return ((code or "").strip().lower(), name.strip().lower())


def _to_time(minutes: int) -> time:
    """510 -> 08:30"""
    return time(hour=minutes // 60, minute=minutes % 60)


def _session_dates(day_of_week: int, weeks: int, today: date) -> list[date]:
    """The first date on or after today that falls on this weekday, then every week."""
    offset = (day_of_week - today.weekday()) % 7
    first = today + timedelta(days=offset)
    return [first + timedelta(days=7 * week) for week in range(weeks)]


def find_problems(classes: list[ClassBlock], sessions: list[ActivationSession]) -> list[str]:
    """
    Checks the whole plan before anything is saved.
    Returns a plain-language list of problems (empty if the plan is fine).
    """
    known_courses = {_identity(c.course_name, c.course_code) for c in classes}
    problems: list[str] = []

    for index, s in enumerate(sessions):
        if not 0 <= s.day_of_week <= 6:
            problems.append(f"Study session {index + 1} has an invalid day.")
            continue

        label = f"{s.course_name} on {DAY_NAMES[s.day_of_week]} {s.start_time}"

        start = _parse_hhmm(s.start_time)
        end = _parse_hhmm(s.end_time)
        if start is None or end is None:
            problems.append(f"{label} can't be saved because its start or end time is unclear.")
            continue

        if not s.venue.strip():
            problems.append(f"{label} needs a venue.")
            continue

        if _identity(s.course_name, s.course_code) not in known_courses:
            problems.append(f"{label} can't be saved because its course is not in your timetable.")
            continue

        # Only compare with earlier sessions so each overlap is reported once
        problem = _find_problem(s.day_of_week, start, end, sessions[:index], classes)
        if problem:
            problems.append(f"{label} can't be saved because {problem}.")

    return problems


def _find_course(db: Session, user_id: str, name: str, code: str | None) -> Course | None:
    """Looks for one of the student's existing courses (by code, or by name if no code)."""
    query = db.query(Course).filter(
        Course.user_id == user_id,
        Course.is_active.is_(True),
    )
    if code:
        return query.filter(func.lower(Course.code) == code.strip().lower()).first()
    return query.filter(func.lower(Course.name) == name.strip().lower()).first()


def activate_plan(
    db: Session,
    user: User,
    import_session: TimetableImport,
    classes: list[ClassBlock],
    sessions: list[ActivationSession],
    weeks: int,
) -> ActivatedPlan:
    """
    Turns the reviewed plan into real data: courses, timetable entries and
    dated study sessions. Raises ValueError (before saving anything) if the
    plan has problems. The caller commits.
    """
    problems = find_problems(classes, sessions)
    if problems:
        message = " ".join(problems[:3])
        if len(problems) > 3:
            message += f" ({len(problems) - 3} more problems.)"
        raise ValueError(message)

    today = datetime.now(timezone.utc).date()

    # 1. Courses: reuse the student's existing ones, create the missing ones
    course_ids: dict[tuple[str, str], str] = {}
    courses_created = 0
    courses_reused = 0

    for c in classes:
        key = _identity(c.course_name, c.course_code)
        if key in course_ids:
            continue

        existing = _find_course(db, user.id, c.course_name, c.course_code)
        if existing:
            course_ids[key] = existing.id
            courses_reused += 1
            continue

        course = Course(
            user_id=user.id,
            name=c.course_name.strip()[:255],
            code=(c.course_code or "").strip()[:50] or None,
            lecturer=(c.lecturer or "")[:255] or None,
        )
        db.add(course)
        db.flush()  # gives the new course its id
        course_ids[key] = course.id
        courses_created += 1

    # 2. Timetable entries: the weekly classes (skipping any that already exist)
    entries_saved = 0
    seen_entries: set[tuple[str, int, int, int]] = set()

    for c in classes:
        course_id = course_ids[_identity(c.course_name, c.course_code)]
        entry_key = (course_id, c.day_of_week, c.start_min, c.end_min)
        if entry_key in seen_entries:
            continue
        seen_entries.add(entry_key)

        start = _to_time(c.start_min)
        end = _to_time(c.end_min)

        already_saved = (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.user_id == user.id,
                TimetableEntry.course_id == course_id,
                TimetableEntry.day_of_week == c.day_of_week,
                TimetableEntry.start_time == start,
                TimetableEntry.end_time == end,
                TimetableEntry.is_active.is_(True),
            )
            .first()
        )
        if already_saved:
            continue

        db.add(
            TimetableEntry(
                user_id=user.id,
                course_id=course_id,
                day_of_week=c.day_of_week,
                start_time=start,
                end_time=end,
                venue=str(c.venue).strip()[:255] or None if c.venue else None,
                lecturer=(c.lecturer or "")[:255] or None,
                class_type=(c.class_type or "lecture")[:50],
            )
        )
        entries_saved += 1

    # 3. Study sessions: each weekly session repeats for the chosen number of weeks
    sessions_created = 0

    for s in sessions:
        course_id = course_ids[_identity(s.course_name, s.course_code)]
        start = _to_time(_parse_hhmm(s.start_time) or 0)
        end = _to_time(_parse_hhmm(s.end_time) or 0)

        for session_date in _session_dates(s.day_of_week, weeks, today):
            db.add(
                StudySession(
                    user_id=user.id,
                    course_id=course_id,
                    topic=s.topic.strip()[:255] or None,
                    session_date=session_date,
                    start_time=start,
                    end_time=end,
                    venue=s.venue.strip(),
                    priority="medium",
                    status="planned",
                    is_ai_generated=True,
                )
            )
            sessions_created += 1

    # 4. This import is now used up
    import_session.status = "confirmed"

    return ActivatedPlan(
        courses_created=courses_created,
        courses_reused=courses_reused,
        timetable_entries_saved=entries_saved,
        study_sessions_created=sessions_created,
        weeks=weeks,
        message=(
            f"Your plan is active. {sessions_created} study sessions were added "
            f"to your planner over the next {weeks} weeks."
        ),
    )