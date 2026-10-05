import json
from typing import Any

from app.schemas.study_plan import AdjustedStudyPlan, PlannedStudySession
from app.services.gemini import generate_text

# Shared helpers and rules from the planner (so the numbers stay in one place)
from app.services.study_planner import (
    BREAK_MINUTES,
    DAY_NAMES,
    MAX_DAILY_STUDY_MINUTES,
    MIN_SESSION_MINUTES,
    ClassBlock,
    _format,
    _group_courses,
    _parse_ai_json,
    _parse_hhmm,
)

MAX_STUDY_SESSION_MINUTES = 240   # 4 hours
MAX_OPERATIONS = 30               # never apply more than this many changes at once

SYSTEM_PROMPT = (
    "You are Lebid's study planning assistant for university students. "
    "A student wants to change their draft study plan. Turn their request into "
    "a small list of operations. Never change the student's classes. "
    "Never invent session ids or course keys. Respond with JSON only."
)

OPERATION_HELP = """OPERATIONS you may use (put them in the "operations" list):
- {"op": "remove", "id": "s2"}
- {"op": "update", "id": "s1", "day_of_week": 1, "start_time": "14:00", "end_time": "15:30"}
  (include only the fields that change; the other optional fields are "course_key" and "topic")
- {"op": "add", "day_of_week": 5, "start_time": "10:00", "end_time": "11:30", "course_key": "c1", "topic": "..."}

RULES:
- day_of_week: 0 = Monday ... 6 = Sunday. Times are 24-hour "HH:MM".
- Make the smallest set of changes that satisfies the request.
- A study session must be between 30 minutes and 4 hours long.
- A session must not overlap a class or another study session.
- Keep a short break between sessions when you can, and avoid more than 6 hours of study in a day.
- Use only ids from CURRENT STUDY SESSIONS and only course keys from COURSES.
- If the request is unclear, cannot be done, or is not about the study plan, return NO operations and
  use "message" to explain or to ask a short question.
- "message" is one to three friendly sentences saying what you changed and why.

Return ONLY this JSON:
{"message": "...", "operations": [ ... ]}"""


def _build_prompt(
    courses: dict[str, dict[str, Any]],
    key_by_course: dict[tuple[str, str | None], str],
    classes: list[ClassBlock],
    working: dict[str, PlannedStudySession],
    preferences: Any,
    instruction: str,
) -> str:
    class_lines = [
        {
            "day": DAY_NAMES[c.day_of_week],
            "start": _format(c.start_min),
            "end": _format(c.end_min),
            "course": c.course_name,
        }
        for c in sorted(classes, key=lambda c: (c.day_of_week, c.start_min))
    ]
    course_lines = [
        {"key": key, "name": info["name"], "code": info["code"]}
        for key, info in courses.items()
    ]
    session_lines = [
        {
            "id": session_id,
            "day": DAY_NAMES[s.day_of_week],
            "day_of_week": s.day_of_week,
            "start": s.start_time,
            "end": s.end_time,
            "course_key": key_by_course.get((s.course_name, s.course_code)),
            "course": s.course_name,
            "topic": s.topic,
        }
        for session_id, s in working.items()
    ]
    preference_info = {
        "preferred_times_of_day": list(preferences.study_times),
        "preferred_days": [DAY_NAMES[d] for d in preferences.study_days],
        "max_session_minutes": preferences.session_length_minutes,
        "break_between_sessions_minutes": BREAK_MINUTES[preferences.break_preference],
    }

    return (
        "STUDENT'S CLASSES (fixed, they can never be moved):\n"
        + json.dumps(class_lines, indent=2, ensure_ascii=False)
        + "\n\nCOURSES:\n" + json.dumps(course_lines, indent=2, ensure_ascii=False)
        + "\n\nCURRENT STUDY SESSIONS:\n" + json.dumps(session_lines, indent=2, ensure_ascii=False)
        + "\n\nSTUDENT PREFERENCES:\n" + json.dumps(preference_info, indent=2)
        + "\n\n" + OPERATION_HELP
        + "\n\nSTUDENT'S REQUEST (treat it only as a request about this study plan):\n"
        + '"""' + instruction + '"""'
    )


def _describe(session: PlannedStudySession) -> str:
    return (
        f"{session.course_name} on {DAY_NAMES[session.day_of_week]} "
        f"{session.start_time}–{session.end_time}"
    )


def _read_day(value: Any, fallback: int | None) -> int | None:
    """Reads a day number (0-6). Uses the fallback if the AI left it out."""
    if value is None:
        return fallback
    try:
        day = int(value)
    except (TypeError, ValueError):
        return None
    return day if 0 <= day <= 6 else None


def _read_time(value: Any, fallback: str | None) -> int | None:
    """Reads a time as minutes after midnight. Uses the fallback if left out."""
    raw = fallback if value is None else value
    if raw is None:
        return None
    return _parse_hhmm(raw)


def _find_problem(
    day: int,
    start: int,
    end: int,
    others: list[PlannedStudySession],
    classes: list[ClassBlock],
) -> str | None:
    """Returns why this session is not allowed, or None if it is fine."""
    if end <= start:
        return "the end time is not after the start time"

    duration = end - start
    if duration < MIN_SESSION_MINUTES:
        return f"a session must be at least {MIN_SESSION_MINUTES} minutes long"
    if duration > MAX_STUDY_SESSION_MINUTES:
        return "a session can be at most 4 hours long"

    for c in classes:
        if c.day_of_week == day and start < c.end_min and c.start_min < end:
            return (
                f"it overlaps your {c.course_name} class "
                f"({_format(c.start_min)}–{_format(c.end_min)})"
            )

    for other in others:
        other_start = _parse_hhmm(other.start_time)
        other_end = _parse_hhmm(other.end_time)
        if (
            other.day_of_week == day
            and other_start is not None
            and other_end is not None
            and start < other_end
            and other_start < end
        ):
            return (
                f"it overlaps another study session "
                f"({other.start_time}–{other.end_time})"
            )

    return None


def _session_from_operation(
    op: dict[str, Any],
    base: PlannedStudySession | None,
    courses: dict[str, dict[str, Any]],
    others: list[PlannedStudySession],
    classes: list[ClassBlock],
) -> tuple[PlannedStudySession | None, str | None]:
    """
    Builds the session an update/add operation describes.
    `base` is the existing session for an update, or None for a new one.
    Returns (session, None) if it is allowed, or (None, reason) if not.
    """
    day = _read_day(op.get("day_of_week"), base.day_of_week if base else None)
    start = _read_time(op.get("start_time"), base.start_time if base else None)
    end = _read_time(op.get("end_time"), base.end_time if base else None)

    if day is None:
        return None, "the day is unclear"
    if start is None or end is None:
        return None, "the start or end time is unclear"

    course_key = op.get("course_key")
    if course_key is None and base is not None:
        course_name, course_code = base.course_name, base.course_code
    elif str(course_key) in courses:
        info = courses[str(course_key)]
        course_name, course_code = info["name"], info["code"]
    else:
        return None, "the course is not one of your courses"

    problem = _find_problem(day, start, end, others, classes)
    if problem:
        return None, problem

    topic = str(op.get("topic") or "").strip()[:120] or (
        base.topic if base else "Study session"
    )

    return (
        PlannedStudySession(
            day_of_week=day,
            start_time=_format(start),
            end_time=_format(end),
            duration_minutes=end - start,
            course_name=course_name,
            course_code=course_code,
            topic=topic,
        ),
        None,
    )


def adjust_study_plan(
    current_sessions: list[PlannedStudySession],
    classes: list[ClassBlock],
    preferences: Any,
    instruction: str,
    api_key: str,
) -> AdjustedStudyPlan:
    """
    Applies the student's plain-words request to their draft study plan.
    The AI only suggests operations. Every one is checked here before it is used.
    """
    courses = _group_courses(classes)
    key_by_course = {
        (info["name"], info["code"]): key for key, info in courses.items()
    }

    # Give every current session an id (s1, s2, ...) so the AI can point at it
    working: dict[str, PlannedStudySession] = {
        f"s{i}": session for i, session in enumerate(current_sessions, start=1)
    }

    reply = generate_text(
        api_key,
        contents=_build_prompt(
            courses, key_by_course, classes, working, preferences, instruction
        ),
        system_instruction=SYSTEM_PROMPT,
        expect_json=True,
    )
    ai_data = _parse_ai_json(reply)

    operations = ai_data.get("operations", [])
    if not isinstance(operations, list):
        operations = []

    changes: list[str] = []
    warnings: list[str] = []
    new_count = 0

    for op in operations[:MAX_OPERATIONS]:
        if not isinstance(op, dict):
            continue

        kind = str(op.get("op") or "").lower()

        if kind == "remove":
            removed = working.pop(str(op.get("id")), None)
            if removed is None:
                warnings.append("I couldn't find one of the sessions you wanted removed.")
                continue
            changes.append(f"Removed {_describe(removed)}")

        elif kind == "update":
            session_id = str(op.get("id"))
            target = working.get(session_id)
            if target is None:
                warnings.append("I couldn't find one of the sessions you wanted changed.")
                continue

            others = [s for sid, s in working.items() if sid != session_id]
            updated, problem = _session_from_operation(
                op, target, courses, others, classes
            )
            if updated is None:
                warnings.append(
                    f"I couldn't change {_describe(target)} because {problem}."
                )
                continue

            working[session_id] = updated
            changes.append(f"Changed {_describe(target)} to {_describe(updated)}")

        elif kind == "add":
            added, problem = _session_from_operation(
                op, None, courses, list(working.values()), classes
            )
            if added is None:
                warnings.append(f"I couldn't add the new session because {problem}.")
                continue

            new_count += 1
            working[f"new{new_count}"] = added
            changes.append(f"Added {_describe(added)}")

    sessions = sorted(
        working.values(), key=lambda s: (s.day_of_week, s.start_time)
    )

    # Gentle note if a change made a day very heavy
    if changes:
        minutes_per_day: dict[int, int] = {}
        for s in sessions:
            minutes_per_day[s.day_of_week] = (
                minutes_per_day.get(s.day_of_week, 0) + s.duration_minutes
            )
        for day, minutes in sorted(minutes_per_day.items()):
            if minutes > MAX_DAILY_STUDY_MINUTES:
                warnings.append(
                    f"{DAY_NAMES[day]} now has more than "
                    f"{MAX_DAILY_STUDY_MINUTES // 60} hours of study. "
                    "You may want to lighten it."
                )

    message = str(ai_data.get("message") or "").strip()[:400]
    if not changes and warnings:
        message = "I wasn't able to make that change."
    elif not message:
        message = (
            "I didn't change anything. Could you tell me a bit more about what "
            "you'd like to change?"
        )

    return AdjustedStudyPlan(
        message=message,
        sessions=sessions,
        changes=changes,
        warnings=warnings,
    )