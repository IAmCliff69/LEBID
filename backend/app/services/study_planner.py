import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.timetable import TimetableEntry
from app.schemas.study_plan import (
    GeneratedStudyPlan,
    PlannedClass,
    PlannedStudySession,
)
from app.services.gemini import generate_text

DAY_NAMES = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
]

# ---------------------------------------------------------------------------
# Planning rules. Change these numbers to tune how plans are built.
# Times are "minutes after midnight" (7 * 60 = 07:00).
# ---------------------------------------------------------------------------
TIME_WINDOWS = {
    "morning": (7 * 60, 12 * 60),
    "afternoon": (12 * 60, 17 * 60),
    "evening": (17 * 60, 22 * 60),
}
BREAK_MINUTES = {"short": 10, "long": 20}   # gap kept around classes and between sessions
MAX_SESSIONS_PER_DAY = 3  
MIN_SESSION_MINUTES = 30                    # shortest study session
MAX_DAILY_STUDY_MINUTES = 6 * 60            # never plan more than 6 hours in one day                  # never overload a day
GRID_MINUTES = 15                           # session start times snap to 15 minutes


class PlanGenerationError(Exception):
    """The AI answered, but the plan it gave could not be used."""


@dataclass
class ClassBlock:
    """One weekly class (a lecture, lab, ...) the plan must work around."""
    day_of_week: int
    start_min: int
    end_min: int
    course_name: str
    course_code: str | None
    class_type: str
    venue: str | None
    lecturer: str | None = None


@dataclass
class FreeWindow:
    """A stretch of free time where one or more study sessions could happen."""
    window_id: str
    day_of_week: int
    start_min: int
    end_min: int


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _format(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_hhmm(value: Any) -> int | None:
    """'08:30' -> 510. Returns None if the value is not a valid time."""
    try:
        hours, minutes = str(value).strip().split(":")[:2]
        hours, minutes = int(hours), int(minutes)
    except (ValueError, TypeError):
        return None
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        return None
    return hours * 60 + minutes


def _round_up(minutes: int, step: int) -> int:
    return -(-minutes // step) * step


# ---------------------------------------------------------------------------
# Step 1: load the classes to plan around
# ---------------------------------------------------------------------------

def classes_from_extraction(extracted_json: str) -> tuple[list[ClassBlock], int]:
    """
    Reads the classes from a timetable import (what Gemini extracted).
    Returns (classes, number_of_entries_that_could_not_be_used).
    """
    try:
        data = json.loads(extracted_json)
    except (json.JSONDecodeError, TypeError):
        return [], 0

    raw_entries = data.get("entries", []) if isinstance(data, dict) else []
    classes: list[ClassBlock] = []
    skipped = 0

    for entry in raw_entries:
        if not isinstance(entry, dict):
            skipped += 1
            continue

        name = str(entry.get("course_name") or "").strip()
        start = _parse_hhmm(entry.get("start_time"))
        end = _parse_hhmm(entry.get("end_time"))

        try:
            day = int(entry.get("day_of_week"))
        except (TypeError, ValueError):
            day = -1

        if not name or start is None or end is None or start >= end or not 0 <= day <= 6:
            skipped += 1
            continue

        code = str(entry.get("course_code") or "").strip() or None
        lecturer = str(entry.get("lecturer") or "").strip() or None
        classes.append(
            ClassBlock(
                day_of_week=day,
                start_min=start,
                end_min=end,
                course_name=name,
                course_code=code,
                class_type=str(entry.get("class_type") or "lecture"),
                venue=entry.get("venue"),
                lecturer=lecturer,
            )
        )
        

    return classes, skipped


def classes_from_saved_timetable(db: Session, user_id: str) -> tuple[list[ClassBlock], int]:
    """Reads the classes from the student's saved timetable."""
    entries = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.user_id == user_id, TimetableEntry.is_active.is_(True))
        .all()
    )
    classes = [
        ClassBlock(
            day_of_week=e.day_of_week,
            start_min=e.start_time.hour * 60 + e.start_time.minute,
            end_min=e.end_time.hour * 60 + e.end_time.minute,
            course_name=e.course.name,
            course_code=e.course.code,
            class_type=e.class_type,
            venue=e.venue,
        )
        for e in entries
    ]
    return classes, 0


# ---------------------------------------------------------------------------
# Step 2: work out the free slots (plain Python, no AI)
# ---------------------------------------------------------------------------

def find_free_windows(classes: list[ClassBlock], preferences: Any) -> list[FreeWindow]:
    """
    On each preferred study day, finds the stretches of free time inside the
    chosen times of day. A break-sized gap is kept before and after every class.
    """
    gap = BREAK_MINUTES[preferences.break_preference]

    # Join the chosen times of day. Morning + afternoon becomes one long
    # window (07:00-17:00), while morning + evening stay separate.
    time_ranges = sorted(TIME_WINDOWS[name] for name in preferences.study_times)
    merged: list[list[int]] = []
    for start, end in time_ranges:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    windows: list[FreeWindow] = []

    for day in sorted(preferences.study_days):
        # Class times, widened by the break gap on both sides
        busy = sorted(
            (c.start_min - gap, c.end_min + gap)
            for c in classes
            if c.day_of_week == day
        )

        for range_start, range_end in merged:
            # Cut the classes out of this time of day
            cursor = range_start
            free_parts: list[tuple[int, int]] = []

            for busy_start, busy_end in busy:
                if busy_end <= cursor:
                    continue
                if busy_start >= range_end:
                    break
                if busy_start > cursor:
                    free_parts.append((cursor, busy_start))
                cursor = max(cursor, busy_end)

            if cursor < range_end:
                free_parts.append((cursor, range_end))

            # Keep only the parts long enough for a study session
            for part_start, part_end in free_parts:
                start = _round_up(part_start, GRID_MINUTES)
                end = (part_end // GRID_MINUTES) * GRID_MINUTES
                if end - start >= MIN_SESSION_MINUTES:
                    windows.append(
                        FreeWindow(
                            window_id=f"{day}-{_format(start)}",
                            day_of_week=day,
                            start_min=start,
                            end_min=end,
                        )
                    )

    return windows


# ---------------------------------------------------------------------------
# Step 3: ask Gemini to choose from the free slots
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are Lebid's study planning assistant for university students. "
    "You are given free time windows that are already checked against the "
    "student's classes. Your job is to decide which parts of these windows to "
    "use for study sessions, which course to study in each session, how long "
    "each session should be, and a short topic. Never invent window ids or "
    "course keys. Respond with JSON only."
)


def _group_courses(classes: list[ClassBlock]) -> dict[str, dict[str, Any]]:
    """Groups classes by course and gives each course a short key (c1, c2, ...)."""
    by_course: dict[str, dict[str, Any]] = {}
    for c in classes:
        identity = (c.course_code or c.course_name).strip().lower()
        if identity not in by_course:
            by_course[identity] = {
                "name": c.course_name,
                "code": c.course_code,
                "classes": 0,
            }
        by_course[identity]["classes"] += 1

    return {f"c{i}": info for i, info in enumerate(by_course.values(), start=1)}


def _build_prompt(courses: dict[str, dict[str, Any]], windows: list[FreeWindow], preferences: Any) -> str:
    max_minutes = preferences.session_length_minutes
    gap = BREAK_MINUTES[preferences.break_preference]

    preference_info = {
        "preferred_times_of_day": list(preferences.study_times),
        "max_session_minutes": max_minutes,
        "break_between_sessions_minutes": gap,
    }
    course_lines = [
        {
            "key": key,
            "name": info["name"],
            "code": info["code"],
            "classes_per_week": info["classes"],
        }
        for key, info in courses.items()
    ]
    window_lines = [
        {
            "window_id": w.window_id,
            "day": DAY_NAMES[w.day_of_week],
            "start": _format(w.start_min),
            "end": _format(w.end_min),
            "length_minutes": w.end_min - w.start_min,
        }
        for w in windows
    ]

    return (
        "STUDENT PREFERENCES:\n" + json.dumps(preference_info, indent=2)
        + "\n\nCOURSES:\n" + json.dumps(course_lines, indent=2, ensure_ascii=False)
        + "\n\nFREE WINDOWS:\n" + json.dumps(window_lines, indent=2)
        + "\n\nRULES:\n"
        + "- Every session must lie completely inside ONE window: start is not before the window start, "
        + "and start + duration_minutes is not after the window end.\n"
        + "- duration_minutes is a multiple of 15, at least " + str(MIN_SESSION_MINUTES)
        + " and at most " + str(max_minutes) + ".\n"
        + "- Vary the session lengths: longer for courses with more classes per week or heavier work, "
        + "shorter (30 to 60 minutes) for light review. Do NOT make every session the same length.\n"
        + "- Sessions in the same window must be at least " + str(gap) + " minutes apart.\n"
        + "- At most " + str(MAX_SESSIONS_PER_DAY) + " sessions and "
        + str(MAX_DAILY_STUDY_MINUTES // 60) + " hours of study on any single day.\n"
        + "- Aim for about 2 sessions per course across the week when there is room. "
        + "Spread each course across different days.\n"
        + "- Do NOT fill every window. A realistic, lighter plan is better than an overloaded one.\n"
        + "- Use only window_id values from FREE WINDOWS and only course keys from COURSES.\n"
        + "- topic must be short, specific and practical (under 80 characters).\n"
        + "\nReturn ONLY this JSON:\n"
        + '{"summary": "one or two friendly sentences explaining the plan", '
        + '"sessions": [{"window_id": "0-12:00", "start": "12:00", "duration_minutes": 90, '
        + '"course_key": "c1", "topic": "..."}]}'
    )


def _parse_ai_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1]).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        raise PlanGenerationError(
            "The AI returned a plan we couldn't read. Please try again."
        )

    if not isinstance(data, dict):
        raise PlanGenerationError(
            "The AI returned a plan we couldn't read. Please try again."
        )
    return data


# ---------------------------------------------------------------------------
# Step 4: check the AI's choices and build the final plan
# ---------------------------------------------------------------------------

def _build_sessions(
    ai_data: dict[str, Any],
    windows: list[FreeWindow],
    courses: dict[str, dict[str, Any]],
    max_minutes: int,
    gap: int,
) -> list[PlannedStudySession]:
    """Keeps only the AI's choices that are valid. Anything else is dropped."""
    windows_by_id = {w.window_id: w for w in windows}

    raw_sessions = ai_data.get("sessions", [])
    if not isinstance(raw_sessions, list):
        raw_sessions = []

    placed: dict[str, list[tuple[int, int]]] = {}   # sessions already placed in each window
    count_per_day: dict[int, int] = {}
    minutes_per_day: dict[int, int] = {}
    sessions: list[PlannedStudySession] = []

    for item in raw_sessions:
        if not isinstance(item, dict):
            continue

        window = windows_by_id.get(str(item.get("window_id")))
        course = courses.get(str(item.get("course_key")))
        start = _parse_hhmm(item.get("start"))

        try:
            duration = int(item.get("duration_minutes"))
        except (TypeError, ValueError):
            continue

        if window is None or course is None or start is None:
            continue

        # Tidy the numbers: 15-minute steps, never longer than the student's maximum
        start = _round_up(start, GRID_MINUTES)
        duration = min((duration // GRID_MINUTES) * GRID_MINUTES, max_minutes)
        end = start + duration

        # If it runs past the end of the window, shorten it to fit
        window_end = (window.end_min // GRID_MINUTES) * GRID_MINUTES
        end = min(end, window_end)
        duration = end - start

        if duration < MIN_SESSION_MINUTES or start < window.start_min:
            continue

        # No overlap with (or crowding of) other sessions in the same window
        others = placed.get(window.window_id, [])
        if any(start < o_end + gap and o_start < end + gap for o_start, o_end in others):
            continue

        day = window.day_of_week
        if count_per_day.get(day, 0) >= MAX_SESSIONS_PER_DAY:
            continue
        if minutes_per_day.get(day, 0) + duration > MAX_DAILY_STUDY_MINUTES:
            continue

        placed.setdefault(window.window_id, []).append((start, end))
        count_per_day[day] = count_per_day.get(day, 0) + 1
        minutes_per_day[day] = minutes_per_day.get(day, 0) + duration

        topic = str(item.get("topic") or "").strip()[:120] or "Study session"

        sessions.append(
            PlannedStudySession(
                day_of_week=day,
                start_time=_format(start),
                end_time=_format(end),
                duration_minutes=duration,
                course_name=course["name"],
                course_code=course["code"],
                topic=topic,
            )
        )

    sessions.sort(key=lambda s: (s.day_of_week, s.start_time))
    return sessions


def build_study_plan(
    classes: list[ClassBlock],
    skipped_entries: int,
    preferences: Any,
    api_key: str,
) -> GeneratedStudyPlan:
    """
    Builds a proposed study plan.
    Raises ValueError for problems the student can fix (clear message),
    and PlanGenerationError when the AI's answer was not usable.
    """
    windows = find_free_windows(classes, preferences)
    if not windows:
        raise ValueError(
            "We couldn't find any free time in your preferred study days and "
            "times of day. Try different days or times of day."
        )

    courses = _group_courses(classes)

    reply = generate_text(
        api_key,
        contents=_build_prompt(courses, windows, preferences),
        system_instruction=SYSTEM_PROMPT,
        expect_json=True,
    )
    ai_data = _parse_ai_json(reply)
    sessions = _build_sessions(
        ai_data,
        windows,
        courses,
        preferences.session_length_minutes,
        BREAK_MINUTES[preferences.break_preference],
    )

    if not sessions:
        raise PlanGenerationError(
            "The AI could not build a usable plan this time. Please try again."
        )

    # Friendly notes about anything the student should know
    warnings: list[str] = []

    if skipped_entries:
        warnings.append(
            f"{skipped_entries} timetable "
            f"{'entry' if skipped_entries == 1 else 'entries'} could not be used "
            "because the day or time was unclear."
        )

    days_with_windows = {w.day_of_week for w in windows}
    for day in sorted(preferences.study_days):
        if day not in days_with_windows:
            warnings.append(
                f"There is no free time on {DAY_NAMES[day]} in your preferred times of day."
            )

    planned = {(s.course_name, s.course_code) for s in sessions}
    for info in courses.values():
        if (info["name"], info["code"]) not in planned:
            warnings.append(f"No study session could be placed for {info['name']}.")

    summary = str(ai_data.get("summary") or "").strip()[:400] or (
        "Here is a study plan built around your classes and preferences."
    )

    planned_classes = [
        PlannedClass(
            day_of_week=c.day_of_week,
            start_time=_format(c.start_min),
            end_time=_format(c.end_min),
            course_name=c.course_name,
            course_code=c.course_code,
            class_type=c.class_type,
            venue=c.venue,
        )
        for c in sorted(classes, key=lambda c: (c.day_of_week, c.start_min))
    ]

    return GeneratedStudyPlan(
        summary=summary,
        classes=planned_classes,
        sessions=sessions,
        warnings=warnings,
    )