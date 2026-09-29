from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.course import Course
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.course import CreateCourseRequest, UpdateCourseRequest, CourseResponse

router = APIRouter()


def get_course_or_404(course_id: str, user_id: str, db: Session) -> Course:
    """
    Helper that fetches a course by ID and verifies it belongs to the
    requesting user. Raises 404 if not found or not owned by this user.

    Using 404 instead of 403 avoids revealing whether a resource exists
    to users who don't own it.
    """
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


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CreateCourseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new course for the current user.
    """
    course = Course(
        user_id=current_user.id,
        name=payload.name,
        code=payload.code,
        credit_hours=payload.credit_hours,
        color=payload.color,
        lecturer=payload.lecturer,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("", response_model=list[CourseResponse])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all courses belonging to the current user.
    Only active courses are returned by default.
    """
    courses = (
        db.query(Course)
        .filter(Course.user_id == current_user.id, Course.is_active == True)
        .order_by(Course.name)
        .all()
    )
    return courses


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a single course by ID.
    Returns 404 if the course does not exist or belongs to another user.
    """
    return get_course_or_404(course_id, current_user.id, db)


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: str,
    payload: UpdateCourseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates a course. Only the fields provided are changed.
    """
    course = get_course_or_404(course_id, current_user.id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    for field, value in updates.items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", response_model=MessageResponse)
def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a course permanently.

    In later stages, when timetable entries, assignments, and study
    sessions reference courses, we will need to consider what happens
    to those records when a course is deleted. For now, the delete
    is straightforward.
    """
    course = get_course_or_404(course_id, current_user.id, db)
    db.delete(course)
    db.commit()
    return {"message": f"Course '{course.name}' has been deleted."}