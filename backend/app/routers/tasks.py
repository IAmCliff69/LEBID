from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.course import Course
from app.models.task import Task
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse

router = APIRouter()


def get_task_or_404(task_id: str, user_id: str, db: Session) -> Task:
    """Fetches a task by ID and verifies it belongs to the current user."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == user_id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )
    return task


def sync_overdue_status(task: Task) -> None:
    """
    Checks if a task is past its deadline and not yet completed.
    If so, updates its status to overdue.
    This is called whenever a task is read so the status stays current.
    """
    if (
        task.deadline
        and not task.is_completed
        and task.status != "overdue"
        and task.deadline < datetime.now(timezone.utc)
    ):
        task.status = "overdue"


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new task for the current user.
    If a course_id is provided, verifies the course belongs to the user.
    """
    # Verify course ownership if a course is linked
    if payload.course_id:
        course = (
            db.query(Course)
            .filter(Course.id == payload.course_id, Course.user_id == current_user.id)
            .first()
        )
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found.",
            )

    task = Task(
        user_id=current_user.id,
        course_id=payload.course_id,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
        priority=payload.priority,
        category=payload.category,
        estimated_duration_minutes=payload.estimated_duration_minutes,
        notes=payload.notes,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    course_id: str | None = Query(default=None),
    include_completed: bool = Query(default=False),
):
    """
    Returns the current user's tasks with optional filters.

    Filters:
    - status: filter by task status (not_started, in_progress, completed, overdue)
    - priority: filter by priority (low, medium, high, urgent)
    - course_id: filter by course
    - include_completed: whether to include completed tasks (default: false)
    """
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if not include_completed:
        query = query.filter(Task.is_completed == False)

    if status_filter:
        query = query.filter(Task.status == status_filter)

    if priority:
        query = query.filter(Task.priority == priority)

    if course_id:
        query = query.filter(Task.course_id == course_id)

    tasks = query.order_by(Task.deadline.asc().nulls_last(), Task.priority.desc()).all()

    # Sync overdue status for all tasks before returning
    changed = False
    for task in tasks:
        old_status = task.status
        sync_overdue_status(task)
        if task.status != old_status:
            changed = True

    if changed:
        db.commit()

    return tasks


@router.get("/overdue", response_model=list[TaskResponse])
def get_overdue_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all overdue tasks for the current user.
    These are incomplete tasks whose deadline has passed.
    """
    now = datetime.now(timezone.utc)
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.is_completed == False,
            Task.deadline < now,
        )
        .order_by(Task.deadline.asc())
        .all()
    )

    for task in tasks:
        if task.status != "overdue":
            task.status = "overdue"

    db.commit()
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a single task by ID."""
    task = get_task_or_404(task_id, current_user.id, db)
    sync_overdue_status(task)
    db.commit()
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates a task. Only provided fields are changed.

    Special behavior:
    - Setting status to 'completed' automatically sets is_completed=True
      and records the completed_at timestamp.
    - Setting status away from 'completed' clears is_completed and completed_at.
    """
    task = get_task_or_404(task_id, current_user.id, db)

    # Verify course ownership if course_id is being changed
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    if "course_id" in updates and updates["course_id"] is not None:
        course = (
            db.query(Course)
            .filter(
                Course.id == updates["course_id"],
                Course.user_id == current_user.id,
            )
            .first()
        )
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found.",
            )

    for field, value in updates.items():
        setattr(task, field, value)

    # Handle completion status automatically
    if "status" in updates:
        if updates["status"] == "completed":
            task.is_completed = True
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.is_completed = False
            task.completed_at = None

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a task permanently."""
    task = get_task_or_404(task_id, current_user.id, db)
    db.delete(task)
    db.commit()
    return {"message": f"Task '{task.title}' has been deleted."}