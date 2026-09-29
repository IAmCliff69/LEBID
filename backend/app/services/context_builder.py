from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.course import Course
from app.models.timetable import TimetableEntry
from app.models.study_session import StudySession
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.event import Event
from app.models.task import Task


DAY_NAMES = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday",
    3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday",
}


def build_student_context(user: User, db: Session) -> dict:
    """
    Builds a comprehensive snapshot of the student's academic situation.

    This context is sent to the AI with every request so the AI
    understands the student's full schedule before making recommendations.

    The context includes:
    - Student profile
    - Active courses
    - Weekly timetable
    - Upcoming assignments (next 30 days)
    - Upcoming exams (next 60 days)
    - Upcoming events (next 14 days)
    - This week's study sessions
    - Missed study sessions
    - Overdue tasks and assignments
    - Today's date
    """
    today = date.today()

    # --- Courses ---
    courses = (
        db.query(Course)
        .filter(Course.user_id == user.id, Course.is_active == True)
        .all()
    )
    courses_data = [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "credit_hours": c.credit_hours,
        }
        for c in courses
    ]

    # --- Weekly timetable ---
    timetable_entries = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == user.id,
            TimetableEntry.is_active == True,
        )
        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
        .all()
    )
    timetable_data = [
        {
            "day": DAY_NAMES.get(e.day_of_week, str(e.day_of_week)),
            "course_id": e.course_id,
            "class_type": e.class_type,
            "start_time": str(e.start_time),
            "end_time": str(e.end_time),
            "venue": e.venue,
        }
        for e in timetable_entries
    ]

    # --- Upcoming assignments (next 30 days) ---
    upcoming_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user.id,
            Assignment.is_completed == False,
            Assignment.deadline >= today,
            Assignment.deadline <= today + timedelta(days=30),
        )
        .order_by(Assignment.deadline.asc())
        .all()
    )
    assignments_data = [
        {
            "id": a.id,
            "course_id": a.course_id,
            "title": a.title,
            "deadline": str(a.deadline.date()),
            "estimated_hours": a.estimated_hours,
            "priority": a.priority,
            "status": a.status,
        }
        for a in upcoming_assignments
    ]

    # --- Overdue assignments ---
    overdue_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == user.id,
            Assignment.is_completed == False,
            Assignment.deadline < today,
        )
        .all()
    )
    overdue_assignments_data = [
        {
            "id": a.id,
            "course_id": a.course_id,
            "title": a.title,
            "deadline": str(a.deadline.date()),
            "status": a.status,
        }
        for a in overdue_assignments
    ]

    # --- Upcoming exams (next 60 days) ---
    upcoming_exams = (
        db.query(Exam)
        .filter(
            Exam.user_id == user.id,
            Exam.exam_date >= today,
            Exam.exam_date <= today + timedelta(days=60),
        )
        .order_by(Exam.exam_date.asc())
        .all()
    )
    exams_data = [
        {
            "id": e.id,
            "course_id": e.course_id,
            "title": e.title,
            "exam_type": e.exam_type,
            "exam_date": str(e.exam_date),
            "days_until": (e.exam_date - today).days,
            "venue": e.venue,
        }
        for e in upcoming_exams
    ]

    # --- Upcoming events (next 14 days) ---
    upcoming_events = (
        db.query(Event)
        .filter(
            Event.user_id == user.id,
            Event.event_date >= today,
            Event.event_date <= today + timedelta(days=14),
        )
        .order_by(Event.event_date.asc())
        .all()
    )
    events_data = [
        {
            "id": e.id,
            "title": e.title,
            "date": str(e.event_date),
            "start_time": str(e.start_time) if e.start_time else None,
            "end_time": str(e.end_time) if e.end_time else None,
            "flexibility": e.flexibility,
        }
        for e in upcoming_events
    ]

    # --- This week's study sessions ---
    week_sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user.id,
            StudySession.session_date >= today,
            StudySession.session_date <= today + timedelta(days=7),
        )
        .order_by(StudySession.session_date.asc(), StudySession.start_time.asc())
        .all()
    )
    sessions_data = [
        {
            "id": s.id,
            "course_id": s.course_id,
            "topic": s.topic,
            "date": str(s.session_date),
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
            "venue": s.venue,
            "status": s.status,
            "priority": s.priority,
        }
        for s in week_sessions
    ]

    # --- Missed study sessions ---
    missed_sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user.id,
            StudySession.session_date < today,
            StudySession.status.in_(["planned", "skipped"]),
        )
        .order_by(StudySession.session_date.desc())
        .limit(10)
        .all()
    )
    missed_data = [
        {
            "id": s.id,
            "course_id": s.course_id,
            "topic": s.topic,
            "date": str(s.session_date),
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
            "status": s.status,
        }
        for s in missed_sessions
    ]

    # --- Overdue tasks ---
    overdue_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.is_completed == False,
            Task.deadline < today,
        )
        .all()
    )
    overdue_tasks_data = [
        {
            "id": t.id,
            "title": t.title,
            "deadline": str(t.deadline.date()) if t.deadline else None,
            "priority": t.priority,
        }
        for t in overdue_tasks
    ]

    return {
        "today": str(today),
        "student": {
            "name": user.full_name,
            "university": user.university,
            "programme": user.programme,
            "level": user.level,
            "semester": user.semester,
        },
        "courses": courses_data,
        "timetable": timetable_data,
        "upcoming_assignments": assignments_data,
        "overdue_assignments": overdue_assignments_data,
        "upcoming_exams": exams_data,
        "upcoming_events": events_data,
        "study_sessions_this_week": sessions_data,
        "missed_study_sessions": missed_data,
        "overdue_tasks": overdue_tasks_data,
    }