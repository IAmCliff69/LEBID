from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.assignment import (
    CreateAssignmentRequest,
    UpdateAssignmentRequest,
    AssignmentResponse,
)

router = APIRouter()


def get_assignment_or_404(assignment_id: str, user_id: str, db: Session) -> Assignment:
    """Fetches an assignment by ID and verifies it belongs to the current user."""
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.id == assignment_id,
            Assignment.user_id == user_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )
    return assignment


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


def sync_overdue_status(assignment: Assignment) -> bool:
    """
    Checks if an assignment is past its deadline and not completed.
    Updates status to overdue if necessary.
    Returns True if the status was changed.
    """
    if (
        not assignment.is_completed
        and assignment.status != "overdue"
        and assignment.deadline < datetime.now(timezone.utc)
    ):
        assignment.status = "overdue"
        return True
    return False


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: CreateAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new assignment linked to a course.
    The course must belong to the current user.
    """
    verify_course_ownership(payload.course_id, current_user.id, db)

    assignment = Assignment(
        user_id=current_user.id,
        course_id=payload.course_id,
        title=payload.title,
        description=payload.description,
        date_assigned=payload.date_assigned,
        deadline=payload.deadline,
        estimated_hours=payload.estimated_hours,
        priority=payload.priority,
        notes=payload.notes,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    course_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    include_completed: bool = Query(default=False),
):
    """
    Returns the current user's assignments with optional filters.

    Filters:
    - course_id: filter by course
    - status: filter by status
    - priority: filter by priority
    - include_completed: whether to include completed assignments (default: false)
    """
    query = db.query(Assignment).filter(Assignment.user_id == current_user.id)

    if not include_completed:
        query = query.filter(Assignment.is_completed == False)

    if course_id:
        query = query.filter(Assignment.course_id == course_id)

    if status_filter:
        query = query.filter(Assignment.status == status_filter)

    if priority:
        query = query.filter(Assignment.priority == priority)

    assignments = query.order_by(Assignment.deadline.asc()).all()

    # Sync overdue status
    changed = False
    for assignment in assignments:
        if sync_overdue_status(assignment):
            changed = True

    if changed:
        db.commit()

    return assignments


@router.get("/upcoming", response_model=list[AssignmentResponse])
def get_upcoming_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=7, ge=1, le=90),
):
    """
    Returns incomplete assignments due within the next N days.
    Default is 7 days. Maximum is 90 days.

    This endpoint is used by the dashboard and AI assistant to
    show the student what is coming up soon.
    """
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == current_user.id,
            Assignment.is_completed == False,
            Assignment.deadline >= now,
            Assignment.deadline <= cutoff,
        )
        .order_by(Assignment.deadline.asc())
        .all()
    )
    return assignments


@router.get("/overdue", response_model=list[AssignmentResponse])
def get_overdue_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all overdue assignments — incomplete assignments whose
    deadline has passed.
    """
    now = datetime.now(timezone.utc)
    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.user_id == current_user.id,
            Assignment.is_completed == False,
            Assignment.deadline < now,
        )
        .order_by(Assignment.deadline.asc())
        .all()
    )

    changed = False
    for assignment in assignments:
        if assignment.status != "overdue":
            assignment.status = "overdue"
            changed = True

    if changed:
        db.commit()

    return assignments


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a single assignment by ID."""
    assignment = get_assignment_or_404(assignment_id, current_user.id, db)
    if sync_overdue_status(assignment):
        db.commit()
    return assignment


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    assignment_id: str,
    payload: UpdateAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates an assignment. Only provided fields are changed.

    Setting status to 'completed' automatically sets is_completed=True
    and records the completed_at timestamp.
    """
    assignment = get_assignment_or_404(assignment_id, current_user.id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    # Verify course ownership if course is being changed
    if "course_id" in updates and updates["course_id"] is not None:
        verify_course_ownership(updates["course_id"], current_user.id, db)

    for field, value in updates.items():
        setattr(assignment, field, value)

    # Handle completion automatically
    if "status" in updates:
        if updates["status"] == "completed":
            assignment.is_completed = True
            assignment.completed_at = datetime.now(timezone.utc)
        else:
            assignment.is_completed = False
            assignment.completed_at = None

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", response_model=MessageResponse)
def delete_assignment(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an assignment permanently."""
    assignment = get_assignment_or_404(assignment_id, current_user.id, db)
    db.delete(assignment)
    db.commit()
    return {"message": f"Assignment '{assignment.title}' has been deleted."}