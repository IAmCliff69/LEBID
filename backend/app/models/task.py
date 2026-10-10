import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Task(Base):
    """
    Represents an academic or personal task the student needs to complete.

    Tasks can be linked to a course (e.g. "Read chapter 5 for COE 353")
    or be personal (e.g. "Buy lab notebook").

    Priority levels: low, medium, high, urgent
    Status values: not_started, in_progress, completed, overdue
    Category values: academic, personal, administrative, other
    """
    __tablename__ = "tasks"

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

    # Optional course link
    course_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Task details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Deadline — stored as a date (not datetime)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Priority: low, medium, high, urgent
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Status: not_started, in_progress, completed, overdue
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")

    # Category: academic, personal, administrative, other
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="academic")

    # Estimated time to complete in minutes
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Optional notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Whether this task is completed
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # When the task was completed
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

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
    user: Mapped["User"] = relationship("User", back_populates="tasks")  # type: ignore
    course: Mapped["Course | None"] = relationship("Course", back_populates="tasks")  # type: ignore

        # Handy shortcuts so API responses can include the course's code and colour
    @property
    def course_code(self) -> str | None:
        return self.course.code if self.course else None

    @property
    def course_color(self) -> str | None:
        return self.course.color if self.course else None

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title} status={self.status}>"