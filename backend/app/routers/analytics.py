from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.analytics import (
    get_study_hours_analytics,
    get_course_distribution,
    get_task_completion_analytics,
    get_assignment_analytics,
    get_workload_overview,
    get_weekly_review,
)

router = APIRouter()


@router.get("/study-hours")
def study_hours(
    period: str = Query(default="this_week", enum=["this_week", "last_week", "this_month", "last_month"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns planned vs completed study hours for a given period.

    Periods: this_week, last_week, this_month, last_month
    """
    return get_study_hours_analytics(current_user.id, db, period)


@router.get("/course-distribution")
def course_distribution(
    period: str = Query(default="this_week", enum=["this_week", "last_week", "this_month", "last_month"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns how completed study hours are distributed across courses.
    """
    return get_course_distribution(current_user.id, db, period)


@router.get("/tasks")
def task_analytics(
    period: str = Query(default="this_week", enum=["this_week", "last_week", "this_month", "last_month"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns task completion metrics for a given period.
    """
    return get_task_completion_analytics(current_user.id, db, period)


@router.get("/assignments")
def assignment_analytics(
    period: str = Query(default="this_week", enum=["this_week", "last_week", "this_month", "last_month"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns assignment completion metrics for a given period.
    """
    return get_assignment_analytics(current_user.id, db, period)


@router.get("/workload")
def workload_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns an overview of upcoming workload pressure for the next 30 days.

    Shows:
    - Assignments due in 7, 14, and 30 days
    - Exams in the next 14 and 30 days
    - Missed study sessions
    - Overdue assignments
    """
    return get_workload_overview(current_user.id, db)


@router.get("/weekly-review")
def weekly_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the weekly review — a summary of last week's performance
    and an overview of the upcoming week's workload.

    Used by the dashboard and the AI assistant to understand
    how the student performed and what needs attention next week.
    """
    return get_weekly_review(current_user.id, db)


@router.get("/summary")
def analytics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a complete analytics summary combining all metrics.
    Used by the dashboard for a full overview.
    """
    return {
        "study_hours": get_study_hours_analytics(current_user.id, db, "this_week"),
        "course_distribution": get_course_distribution(current_user.id, db, "this_week"),
        "tasks": get_task_completion_analytics(current_user.id, db, "this_week"),
        "assignments": get_assignment_analytics(current_user.id, db, "this_week"),
        "workload": get_workload_overview(current_user.id, db),
    }