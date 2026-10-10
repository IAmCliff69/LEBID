from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session
from app.models.notification_preferences import NotificationPreferences
from app.models.notification import Notification
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.study_session import StudySession
from app.models.task import Task


def notification_exists(
    user_id: str,
    notification_type: str,
    linked_item_id: str,
    db: Session,
) -> bool:
    """
    Checks if a notification for a specific item already exists.
    Prevents duplicate notifications for the same event.
    """
    existing = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.notification_type == notification_type,
            Notification.linked_item_id == linked_item_id,
        )
        .first()
    )
    return existing is not None


def generate_notifications(user_id: str, db: Session) -> int:
    """
    Scans the student's data and generates notifications for
    anything that needs their attention.

    Generates notifications for:
    - Assignments due in 3 days or less
    - Assignments due in 7 days
    - Exams in 7 days or less
    - Exams in 14 days
    - Missed study sessions
    - Overdue tasks

    Returns the number of new notifications created.
    """
    today = date.today()
    now = datetime.now(timezone.utc)
    created_count = 0

        # Which kinds of notifications does this student want? (default: all)
    preferences = (
        db.query(NotificationPreferences)
        .filter(NotificationPreferences.user_id == user_id)
        .first()
    )
    deadlines_on = preferences.deadline_reminders if preferences else True
    exams_on = preferences.exam_reminders if preferences else True
    missed_sessions_on = preferences.missed_session_alerts if preferences else True

    # --- Assignment deadline notifications ---
    upcoming_assignments = (
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
        .all()
    )

    for assignment in (upcoming_assignments if deadlines_on else []):
        days_until = (assignment.deadline.date() - today).days

        if days_until <= 3:
            notif_type = "deadline_urgent"
            title = f"Assignment due soon: {assignment.title}"
            message = (
                f"Your assignment '{assignment.title}' is due in "
                f"{'today' if days_until == 0 else f'{days_until} day(s)'}. "
                f"Make sure you have enough time to complete it."
            )
        else:
            notif_type = "deadline"
            title = f"Upcoming assignment: {assignment.title}"
            message = (
                f"Your assignment '{assignment.title}' is due in {days_until} days. "
                f"Plan your study sessions accordingly."
            )

        if not notification_exists(user_id, notif_type, assignment.id, db):
            db.add(Notification(
                user_id=user_id,
                notification_type=notif_type,
                title=title,
                message=message,
                linked_item_type="assignment",
                linked_item_id=assignment.id,
            ))
            created_count += 1

    # --- Exam notifications ---
    upcoming_exams = (
        db.query(Exam)
        .filter(
            Exam.user_id == user_id,
            Exam.exam_date >= today,
            Exam.exam_date <= today + timedelta(days=14),
        )
        .all()
    )

    for exam in (upcoming_exams if exams_on else []):
        days_until = (exam.exam_date - today).days

        if days_until <= 7:
            notif_type = "exam_urgent"
            title = f"Exam approaching: {exam.title}"
            message = (
                f"Your {exam.exam_type.replace('_', ' ')} '{exam.title}' is in "
                f"{'today' if days_until == 0 else f'{days_until} day(s)'}. "
                f"Review your study plan and make sure you are prepared."
            )
        else:
            notif_type = "exam"
            title = f"Upcoming exam: {exam.title}"
            message = (
                f"Your {exam.exam_type.replace('_', ' ')} '{exam.title}' is in "
                f"{days_until} days. Start planning your revision sessions."
            )

        if not notification_exists(user_id, notif_type, exam.id, db):
            db.add(Notification(
                user_id=user_id,
                notification_type=notif_type,
                title=title,
                message=message,
                linked_item_type="exam",
                linked_item_id=exam.id,
            ))
            created_count += 1

    # --- Missed study session notifications ---
    missed_sessions = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.session_date < today,
            StudySession.status.in_(["planned", "skipped"]),
        )
        .all()
    )

    for session in (missed_sessions if missed_sessions_on else []):
        notif_type = "missed_session"
        if not notification_exists(user_id, notif_type, session.id, db):
            db.add(Notification(
                user_id=user_id,
                notification_type=notif_type,
                title="Missed study session",
                message=(
                    f"You missed a study session on {session.session_date}. "
                    f"Would you like to reschedule it?"
                ),
                linked_item_type="study_session",
                linked_item_id=session.id,
            ))
            created_count += 1

    # --- Overdue task notifications ---
    overdue_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.is_completed == False,
            Task.deadline < now,
        )
        .all()
    )

    for task in (overdue_tasks if deadlines_on else []):
        notif_type = "overdue_task"
        if not notification_exists(user_id, notif_type, task.id, db):
            db.add(Notification(
                user_id=user_id,
                notification_type=notif_type,
                title=f"Overdue task: {task.title}",
                message=(
                    f"Your task '{task.title}' was due on "
                    f"{task.deadline.date()} and is now overdue."
                ),
                linked_item_type="task",
                linked_item_id=task.id,
            ))
            created_count += 1

    db.commit()
    return created_count