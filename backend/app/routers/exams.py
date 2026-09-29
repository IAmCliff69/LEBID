from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.course import Course
from app.models.exam import Exam
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.exam import CreateExamRequest, UpdateExamRequest, ExamResponse


router = APIRouter()


def get_exam_or_404(
    exam_id: str,
    user_id: str,
    db: Session,
) -> Exam:
    """Fetches an exam by ID and verifies it belongs to the current user."""

    exam = (
        db.query(Exam)
        .filter(
            Exam.id == exam_id,
            Exam.user_id == user_id,
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    return exam


def verify_course_ownership(
    course_id: str,
    user_id: str,
    db: Session,
) -> Course:
    """Verifies the course exists and belongs to the current user."""

    course = (
        db.query(Course)
        .filter(
            Course.id == course_id,
            Course.user_id == user_id,
        )
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )

    return course


@router.post(
    "",
    response_model=ExamResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exam(
    payload: CreateExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new exam linked to a course.
    The course must belong to the current user.
    """

    verify_course_ownership(
        payload.course_id,
        current_user.id,
        db,
    )

    exam = Exam(
        user_id=current_user.id,
        course_id=payload.course_id,
        title=payload.title,
        exam_type=payload.exam_type,
        exam_date=payload.exam_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        venue=payload.venue,
        notes=payload.notes,
    )

    db.add(exam)
    db.commit()
    db.refresh(exam)

    return exam


@router.get(
    "",
    response_model=list[ExamResponse],
)
def list_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    course_id: str | None = Query(default=None),
    exam_type: str | None = Query(default=None),
    upcoming_only: bool = Query(default=False),
):
    """
    Returns the current user's exams with optional filters.

    Filters:
    - course_id: filter by course
    - exam_type: filter by type
    - upcoming_only: only return exams from today onwards
    """

    query = db.query(Exam).filter(
        Exam.user_id == current_user.id
    )

    if course_id:
        query = query.filter(
            Exam.course_id == course_id
        )

    if exam_type:
        query = query.filter(
            Exam.exam_type == exam_type
        )

    if upcoming_only:
        today = date.today()
        query = query.filter(
            Exam.exam_date >= today
        )

    exams = (
        query
        .order_by(Exam.exam_date.asc())
        .all()
    )

    return exams


@router.get(
    "/upcoming",
    response_model=list[ExamResponse],
)
def get_upcoming_exams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(
        default=30,
        ge=1,
        le=180,
    ),
):
    """
    Returns exams scheduled within the next N days.

    Default is 30 days. Maximum is 180 days.

    Used by the dashboard and AI assistant to show approaching exams
    and recommend increased study time for those courses.
    """

    today = date.today()
    cutoff = today + timedelta(days=days)

    exams = (
        db.query(Exam)
        .filter(
            Exam.user_id == current_user.id,
            Exam.exam_date >= today,
            Exam.exam_date <= cutoff,
        )
        .order_by(Exam.exam_date.asc())
        .all()
    )

    return exams


@router.get(
    "/{exam_id}",
    response_model=ExamResponse,
)
def get_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a single exam by ID."""

    return get_exam_or_404(
        exam_id,
        current_user.id,
        db,
    )


@router.patch(
    "/{exam_id}",
    response_model=ExamResponse,
)
def update_exam(
    exam_id: str,
    payload: UpdateExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an exam. Only provided fields are changed."""

    exam = get_exam_or_404(
        exam_id,
        current_user.id,
        db,
    )

    updates = payload.model_dump(
        exclude_unset=True
    )

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    if (
        "course_id" in updates
        and updates["course_id"] is not None
    ):
        verify_course_ownership(
            updates["course_id"],
            current_user.id,
            db,
        )

    for field, value in updates.items():
        setattr(exam, field, value)

    db.commit()
    db.refresh(exam)

    return exam


@router.delete(
    "/{exam_id}",
    response_model=MessageResponse,
)
def delete_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an exam permanently."""

    exam = get_exam_or_404(
        exam_id,
        current_user.id,
        db,
    )

    db.delete(exam)
    db.commit()

    return {
        "message": f"Exam '{exam.title}' has been deleted."
    }