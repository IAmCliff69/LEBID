from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.study_session import StudySession
from app.models.task import Task
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.course import Course


def get_date_range(period: str) -> tuple[date, date]:
    """
    Returns start and end dates for a given period.
    Periods: this_week, last_week, this_month, last_month
    """
    today = date.today()

    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == "last_week":
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
    elif period == "this_month":
        start = today.replace(day=1)
        next_month = (start + timedelta(days=32)).replace(day=1)
        end = next_month - timedelta(days=1)
    elif period == "last_month":
        first_this_month = today.replace(day=1)
        end = first_this_month - timedelta(days=1)
        start = end.replace(day=1)
    else:
        # Default to this week
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)

    return start, end


def calculate_session_duration_minutes(session: StudySession) -> float:
    """Calculates how long a study session is in minutes."""
    start = datetime.combine(date.today(), session.start_time)
    end = datetime.combine(date.today(), session.end_time)
    return (end - start).total_seconds() / 60


def get_study_hours_analytics(user_id: str, db: Session, period: str = "this_week") -> dict:
    """
    Returns planned vs completed study hours for a given period.
    """
    start, end = get_date_range(period)

    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.session_date >= start,
            StudySession.session_date <= end,
        )
        .all()
    )

    planned_minutes = 0.0
    completed_minutes = 0.0
    skipped_minutes = 0.0

    for session in sessions:
        duration = calculate_session_duration_minutes(session)
        planned_minutes += duration
        if session.status == "completed":
            completed_minutes += duration
        elif session.status == "skipped":
            skipped_minutes += duration

    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.status == "completed")
    skipped_sessions = sum(1 for s in sessions if s.status == "skipped")
    missed_sessions = sum(
        1 for s in sessions
        if s.status in ["planned", "skipped"] and s.session_date < date.today()
    )

    completion_rate = (
        round(completed_sessions / total_sessions * 100, 1)
        if total_sessions > 0 else 0.0
    )

    return {
        "period": period,
        "date_range": {"start": str(start), "end": str(end)},
        "planned_hours": round(planned_minutes / 60, 1),
        "completed_hours": round(completed_minutes / 60, 1),
        "skipped_hours": round(skipped_minutes / 60, 1),
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "skipped_sessions": skipped_sessions,
        "missed_sessions": missed_sessions,
        "completion_rate_percent": completion_rate,
    }


def get_course_distribution(user_id: str, db: Session, period: str = "this_week") -> list[dict]:
    """
    Returns how study hours are distributed across courses.
    """
    start, end = get_date_range(period)

    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.session_date >= start,
            StudySession.session_date <= end,
            StudySession.status == "completed",
        )
        .all()
    )

    # Group by course
    course_minutes: dict[str, float] = {}
    for session in sessions:
        duration = calculate_session_duration_minutes(session)
        if session.course_id not in course_minutes:
            course_minutes[session.course_id] = 0.0
        course_minutes[session.course_id] += duration

    if not course_minutes:
        return []

    # Fetch course names
    courses = (
        db.query(Course)
        .filter(
            Course.user_id == user_id,
            Course.id.in_(list(course_minutes.keys())),
        )
        .all()
    )
    course_map = {c.id: c for c in courses}

    total_minutes = sum(course_minutes.values())

    distribution = []
    for course_id, minutes in sorted(course_minutes.items(), key=lambda x: x[1], reverse=True):
        course = course_map.get(course_id)
        distribution.append({
            "course_id": course_id,
            "course_name": course.name if course else "Unknown",
            "course_code": course.code if course else None,
            "hours": round(minutes / 60, 1),
            "percentage": round(minutes / total_minutes * 100, 1) if total_minutes > 0 else 0,
        })

    return distribution


def get_task_completion_analytics(user_id: str, db: Session, period: str = "this_week") -> dict:
    """
    Returns task completion metrics for a given period.
    """
    start, end = get_date_range(period)
    now = datetime.now(timezone.utc)

    # Tasks created in this period
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.created_at >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Task.created_at <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .all()
    )

    total = len(tasks)
    completed = sum(1 for t in tasks if t.is_completed)
    overdue = sum(
        1 for t in tasks
        if not t.is_completed and t.deadline and t.deadline < now
    )

    return {
        "period": period,
        "total_tasks": total,
        "completed_tasks": completed,
        "overdue_tasks": overdue,
        "pending_tasks": total - completed - overdue,
        "completion_rate_percent": round(completed / total * 100, 1) if total > 0 else 0.0,
    }


def get_assignment_analytics(user_id: str, db: Session, period: str = "this_week") -> dict:
    """
    Returns assignment completion metrics for a given period.
    """
    start, end = get_date_range(period)
    now = datetime.now(timezone.utc)

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user_id,
            Assignment.deadline >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Assignment.deadline <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .all()
    )

    total = len(assignments)
    completed = sum(1 for a in assignments if a.is_completed)
    overdue = sum(
        1 for a in assignments
        if not a.is_completed and a.deadline < now
    )

    return {
        "period": period,
        "total_assignments": total,
        "completed_assignments": completed,
        "overdue_assignments": overdue,
        "pending_assignments": total - completed - overdue,
        "completion_rate_percent": round(completed / total * 100, 1) if total > 0 else 0.0,
    }


def get_workload_overview(user_id: str, db: Session) -> dict:
    """
    Returns an overview of upcoming workload pressure.
    Looks at the next 30 days for assignments and exams.
    """
    today = date.today()
    now = datetime.now(timezone.utc)

    # Upcoming assignments grouped by urgency
    assignments_7 = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user_id,
            Assignment.is_completed == False,
            Assignment.deadline >= now,
            Assignment.deadline <= datetime.combine(
                today + timedelta(days=7),
                datetime.max.time()
            ).replace(tzinfo=timezone.utc),
        )
        .count()
    )

    assignments_14 = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user_id,
            Assignment.is_completed == False,
            Assignment.deadline >= now,
            Assignment.deadline <= datetime.combine(
                today + timedelta(days=14),
                datetime.max.time()
            ).replace(tzinfo=timezone.utc),
        )
        .count()
    )

    assignments_30 = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user_id,
            Assignment.is_completed == False,
            Assignment.deadline >= now,
            Assignment.deadline <= datetime.combine(
                today + timedelta(days=30),
                datetime.max.time()
            ).replace(tzinfo=timezone.utc),
        )
        .count()
    )

    # Upcoming exams
    exams_14 = (
        db.query(Exam)
        .filter(
            Exam.user_id == user_id,
            Exam.exam_date >= today,
            Exam.exam_date <= today + timedelta(days=14),
        )
        .count()
    )

    exams_30 = (
        db.query(Exam)
        .filter(
            Exam.user_id == user_id,
            Exam.exam_date >= today,
            Exam.exam_date <= today + timedelta(days=30),
        )
        .count()
    )

    # Missed sessions
    missed_sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.session_date < today,
            StudySession.status.in_(["planned", "skipped"]),
        )
        .count()
    )

    # Overdue assignments
    overdue_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user_id,
            Assignment.is_completed == False,
            Assignment.deadline < now,
        )
        .count()
    )

    return {
        "today": str(today),
        "assignments_due_in_7_days": assignments_7,
        "assignments_due_in_14_days": assignments_14,
        "assignments_due_in_30_days": assignments_30,
        "exams_in_14_days": exams_14,
        "exams_in_30_days": exams_30,
        "missed_study_sessions": missed_sessions,
        "overdue_assignments": overdue_assignments,
    }


def get_weekly_review(user_id: str, db: Session) -> dict:
    """
    Generates a weekly review comparing last week's performance
    and previewing the upcoming week.
    """
    last_week_study = get_study_hours_analytics(user_id, db, "last_week")
    this_week_study = get_study_hours_analytics(user_id, db, "this_week")
    last_week_tasks = get_task_completion_analytics(user_id, db, "last_week")
    last_week_assignments = get_assignment_analytics(user_id, db, "last_week")
    course_dist = get_course_distribution(user_id, db, "last_week")
    workload = get_workload_overview(user_id, db)

    return {
        "last_week": {
            "study_hours": last_week_study,
            "tasks": last_week_tasks,
            "assignments": last_week_assignments,
            "course_distribution": course_dist,
        },
        "this_week": {
            "study_hours": this_week_study,
        },
        "upcoming_workload": workload,
    }