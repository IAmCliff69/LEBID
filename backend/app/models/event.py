import uuid
from datetime import datetime, timezone, date, time

from sqlalchemy import String, Text, DateTime, ForeignKey, Date, Time, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Event(Base):
    """
    Represents a non-academic event in the student's schedule.

    Examples: church, meetings, appointments, travel, social events.

    The scheduling system uses events to avoid placing study sessions
    during times the student is unavailable.

    Flexibility levels:
    - fixed: cannot be moved (e.g. a church service, an exam)
    - flexible: can be moved if necessary (e.g. a casual meetup)
    - protected: important personal commitment the student does not
                 want the system to touch (e.g. a family event)
    """
    __tablename__ = "events"

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

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # fixed, flexible, protected
    flexibility: Mapped[str] = mapped_column(String(20), nullable=False, default="fixed")

    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    user: Mapped["User"] = relationship("User", back_populates="events")  # type: ignore

    def __repr__(self) -> str:
        return f"<Event id={self.id} title={self.title} date={self.event_date}>"