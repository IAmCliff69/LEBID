import uuid
from datetime import datetime, timezone, date, time, timedelta

from sqlalchemy import String, Text, DateTime, ForeignKey, Date, Time, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StudySession(Base):
    """
    Represents a planned block of study time for a specific course.

    Every study session must have a venue. A session without a location
    is not a valid Lebid study session. This ensures the student knows
    exactly where they are supposed to be studying.

    Status values:
    - planned: scheduled but not yet started
    - in_progress: currently active
    - completed: student finished the session
    - skipped: student did not attend
    - rescheduled: moved to another time

    Priority values:
    - low, medium, high, urgent
    """
    __tablename__ = "study_sessions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # What the student plans to study in this session
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Date and time of the session
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Venue is required — every session must have a location
    venue: Mapped[str] = mapped_column(String(255), nullable=False)

    # Priority: low, medium, high, urgent
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Status: planned, in_progress, completed, skipped, rescheduled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")

    # Optional notes for the session
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # If this session was rescheduled, track the original session
    rescheduled_from_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("study_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Whether this session was AI-generated or manually created
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    user: Mapped["User"] = relationship("User", back_populates="study_sessions")  # type: ignore
    course: Mapped["Course"] = relationship("Course", back_populates="study_sessions")  # type: ignore

    def __repr__(self) -> str:
        return f"<StudySession id={self.id} date={self.session_date} status={self.status}>"

    @property
    def is_edit_locked(self) -> bool:
        """
        True once the session ended more than 24 hours ago.
        After that the student can no longer edit or reschedule it.
        """
        ends_at = datetime.combine(self.session_date, self.end_time)
        return datetime.now() > ends_at + timedelta(hours=24)