import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LectureOccurrence(Base):
    """
    A note about ONE date of a weekly class, for example
    "COE 354 on Mon 5 Oct was cancelled" or "I missed COE 368 on Wed 7 Oct".

    The timetable repeats every week, so a class has no dates of its own.
    This table records what happened on a specific date, without touching
    the other weeks.

    status: "missed" or "cancelled"
    """
    __tablename__ = "lecture_occurrences"
    __table_args__ = (
        UniqueConstraint(
            "timetable_entry_id",
            "occurrence_date",
            name="uq_lecture_occurrence_entry_date",
        ),
    )

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

    # The class this note is about. If the class is deleted later, the note
    # stays as history (the link just becomes empty).
    timetable_entry_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("timetable_entries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    occurrence_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    # A copy of the class details at the time of marking, so the history
    # still reads correctly if the class is edited or deleted afterwards.
    course_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    course_name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    class_type: Mapped[str] = mapped_column(String(50), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)

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