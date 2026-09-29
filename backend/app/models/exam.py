import uuid
from datetime import datetime, timezone, date, time

from sqlalchemy import String, Text, DateTime, ForeignKey, Date, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Exam(Base):
    """
    Represents a scheduled examination for a course.

    Exams are fixed events — they cannot be moved by the planning
    system. When an exam is approaching, the AI assistant will
    recommend increased revision time for that course.

    Exam types:
    - mid_semester: mid-semester examination
    - end_semester: end-of-semester examination
    - quiz: short in-class quiz
    - test: class test
    - practical: practical/lab examination
    - other: any other examination type
    """
    __tablename__ = "exams"

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

    # Exams must always be linked to a course
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Exam details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    user: Mapped["User"] = relationship("User", back_populates="exams")  # type: ignore
    course: Mapped["Course"] = relationship("Course", back_populates="exams")  # type: ignore

    def __repr__(self) -> str:
        return f"<Exam id={self.id} title={self.title} date={self.exam_date}>"