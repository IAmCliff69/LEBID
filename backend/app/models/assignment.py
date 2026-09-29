import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Assignment(Base):
    """
    Represents a structured piece of academic work assigned in a course.

    Assignments differ from general tasks in that they are always
    linked to a course, have a date they were assigned, and track
    estimated hours of work required.

    The AI planning system uses assignment data to analyze workload
    and recommend appropriate study sessions.

    Priority levels: low, medium, high, urgent
    Status values: not_started, in_progress, completed, overdue
    """
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Owner
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Assignments must always be linked to a course
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Assignment details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # When the assignment was given
    date_assigned: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # When it is due
    deadline: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Estimated hours of work required
    estimated_hours: Mapped[float | None] = mapped_column(
        Integer, nullable=True
    )

    # Priority: low, medium, high, urgent
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Status: not_started, in_progress, completed, overdue
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")

    # Completion tracking
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="assignments")  # type: ignore
    course: Mapped["Course"] = relationship("Course", back_populates="assignments")  # type: ignore

    def __repr__(self) -> str:
        return f"<Assignment id={self.id} title={self.title} status={self.status}>"