import uuid
from datetime import datetime, timezone

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StudyPreferences(Base):
    """
    How a student likes to study. Each student has at most ONE row here.

    study_time:  morning, afternoon or evening
    study_days:  list of day numbers, 0 = Monday ... 6 = Sunday
    break_preference: short or long
    """
    __tablename__ = "study_preferences"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # unique=True means one student can only have one preferences row
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

        # One or more of: morning, afternoon, evening
    study_times: Mapped[list[str]] = mapped_column(ARRAY(String(20)), nullable=False)
    study_days: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    session_length_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    break_preference: Mapped[str] = mapped_column(String(20), nullable=False)

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

    def __repr__(self) -> str:
        return f"<StudyPreferences user_id={self.user_id}>"