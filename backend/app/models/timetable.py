import uuid
from datetime import datetime, time, timezone

from sqlalchemy import String, Time, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimetableEntry(Base):
    """
    Represents a single recurring weekly class in the student's timetable.

    For example:
    - COE 354 Lecture — Monday, 08:00–10:00, Room LT1
    - COE 368 Lab — Wednesday, 14:00–16:00, Lab 3

    These entries repeat every week. They are the fixed commitments
    that everything else in Lebid is planned around.

    day_of_week uses integers:
        0 = Monday
        1 = Tuesday
        2 = Wednesday
        3 = Thursday
        4 = Friday
        5 = Saturday
        6 = Sunday
    """
    __tablename__ = "timetable_entries"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Owner of this entry
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The course this entry belongs to
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Class details
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lecturer: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Class type: lecture, tutorial, lab, practical, etc.
    class_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="lecture",
    )

    # Whether this entry is currently active
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional notes
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

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
    user: Mapped["User"] = relationship("User", back_populates="timetable_entries")  # type: ignore
    course: Mapped["Course"] = relationship("Course", back_populates="timetable_entries")  # type: ignore

    def __repr__(self) -> str:
        return f"<TimetableEntry id={self.id} day={self.day_of_week} start={self.start_time}>"